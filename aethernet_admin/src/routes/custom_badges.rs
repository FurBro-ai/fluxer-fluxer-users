// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    acl,
    middleware::{auth::AuthContext, csrf, flash::{self, FlashData}},
    state::AppState,
    templates,
};
use axum::{
    Form, Router,
    extract::{Request, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

const MAX_BADGES: usize = 100;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CustomBadge {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub color: String,
    pub sort_order: i32,
    pub enabled: bool,
    #[serde(default)]
    pub assigned_user_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct BadgeForm {
    #[serde(default)]
    action: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    icon_url: String,
    #[serde(default = "default_color")]
    color: String,
    #[serde(default)]
    sort_order: i32,
    #[serde(default)]
    enabled: Option<String>,
    #[serde(default)]
    assigned_user_ids: String,
}

fn default_color() -> String { "#7c3aed".to_owned() }

pub fn router() -> Router<AppState> {
    Router::new().route("/custom-badges", get(page).post(save))
}

fn catalogue_path() -> PathBuf {
    std::env::var_os("AETHERNET_CUSTOM_BADGES_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(".aethernet/custom-badges.json"))
}

fn load_catalogue() -> Result<Vec<CustomBadge>, String> {
    let path = catalogue_path();
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Could not read badge catalogue: {error}")),
    };
    serde_json::from_str(&raw).map_err(|error| format!("Badge catalogue is invalid: {error}"))
}

fn persist_catalogue(badges: &[CustomBadge]) -> Result<(), String> {
    let path = catalogue_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Could not create badge directory: {error}"))?;
    }
    let temporary = path.with_extension("json.tmp");
    let raw = serde_json::to_vec_pretty(badges).map_err(|error| error.to_string())?;
    fs::write(&temporary, raw).map_err(|error| format!("Could not write badge catalogue: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("Could not commit badge catalogue: {error}"))
}

fn can_view(auth: &AuthContext) -> bool {
    auth.admin_user.as_ref().is_some_and(|user| acl::has_any_permission(
        &user.acls,
        &[acl::INSTANCE_CONFIG_VIEW, acl::INSTANCE_CONFIG_UPDATE],
    ))
}

fn can_update(auth: &AuthContext) -> bool {
    auth.admin_user.as_ref().is_some_and(|user| acl::has_permission(&user.acls, acl::INSTANCE_CONFIG_UPDATE))
}

async fn page(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    request: Request,
) -> Response {
    if !can_view(&auth.0) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let csrf_token = csrf::get_csrf_token(&request);
    let flash_message = crate::middleware::auth::get_flash(&request).map(|value| value.to_flash_message());
    let (badges, error) = match load_catalogue() {
        Ok(mut badges) => {
            badges.sort_by_key(|badge| (badge.sort_order, badge.name.to_ascii_lowercase()));
            (badges, None)
        }
        Err(error) => (Vec::new(), Some(error)),
    };
    let markup = templates::pages::custom_badges::custom_badges_page(
        state.config(),
        &auth.0,
        &badges,
        error.as_deref(),
        &csrf_token,
        flash_message.as_ref(),
        can_update(&auth.0),
    );
    Html(markup.into_string()).into_response()
}

async fn save(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    Form(form): Form<BadgeForm>,
) -> Response {
    let config = state.config();
    let redirect = format!("{}/custom-badges", config.base_path);
    if !can_update(&auth.0) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let result = update_catalogue(form);
    let notice = match result {
        Ok(message) => FlashData::success(message),
        Err(message) => FlashData::error(message),
    };
    flash::redirect_with_flash(&redirect, notice, config.secure_cookies())
}

fn update_catalogue(form: BadgeForm) -> Result<String, String> {
    let mut badges = load_catalogue()?;
    if form.action == "delete" {
        let before = badges.len();
        badges.retain(|badge| badge.id != form.id);
        if badges.len() == before { return Err("Badge not found".to_owned()); }
        persist_catalogue(&badges)?;
        return Ok("Custom badge deleted".to_owned());
    }

    let badge = validate_badge(form)?;
    if let Some(existing) = badges.iter_mut().find(|item| item.id == badge.id) {
        *existing = badge;
    } else {
        if badges.len() >= MAX_BADGES { return Err(format!("Badge catalogue is limited to {MAX_BADGES} items")); }
        badges.push(badge);
    }
    badges.sort_by_key(|badge| (badge.sort_order, badge.name.to_ascii_lowercase()));
    persist_catalogue(&badges)?;
    Ok("Custom badge saved".to_owned())
}

fn parse_assigned_user_ids(raw: &str) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for part in raw.split([',', '\n', ';']) {
        let id = part.trim();
        if id.is_empty() {
            continue;
        }
        if id.len() > 64 || !id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_') {
            return Err("Assigned users must be comma-separated IDs (letters, numbers, - and _)".to_owned());
        }
        if !out.iter().any(|existing: &String| existing == id) {
            out.push(id.to_owned());
        }
        if out.len() > 1000 {
            return Err("A badge can be assigned to at most 1000 users".to_owned());
        }
    }
    Ok(out)
}

fn validate_badge(form: BadgeForm) -> Result<CustomBadge, String> {
    let name = form.name.trim();
    if name.is_empty() || name.chars().count() > 48 { return Err("Name must contain 1–48 characters".to_owned()); }
    let description = form.description.trim();
    if description.chars().count() > 160 { return Err("Description cannot exceed 160 characters".to_owned()); }
    let icon_url = form.icon_url.trim();
    let valid_icon = icon_url.starts_with("https://") || icon_url.starts_with('/') || icon_url.starts_with("data:image/svg+xml,");
    if !valid_icon || icon_url.len() > 2048 { return Err("Icon must be an HTTPS URL, local /path, or inline SVG data URL".to_owned()); }
    let color = form.color.trim().to_ascii_lowercase();
    if color.len() != 7 || !color.starts_with('#') || !color[1..].chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err("Color must use #RRGGBB format".to_owned());
    }
    let id = if form.id.trim().is_empty() { slugify(name) } else { form.id.trim().to_owned() };
    if id.is_empty() || id.len() > 64 || !id.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-') {
        return Err("Badge ID must contain lowercase letters, numbers, and hyphens".to_owned());
    }
    let assigned_user_ids = parse_assigned_user_ids(&form.assigned_user_ids)?;
    Ok(CustomBadge { id, name: name.to_owned(), description: description.to_owned(), icon_url: icon_url.to_owned(), color, sort_order: form.sort_order.clamp(-10_000, 10_000), enabled: form.enabled.is_some(), assigned_user_ids })
}

fn slugify(value: &str) -> String {
    value.to_ascii_lowercase().chars().fold(String::new(), |mut output, ch| {
        if ch.is_ascii_alphanumeric() { output.push(ch); }
        else if !output.is_empty() && !output.ends_with('-') { output.push('-'); }
        output
    }).trim_matches('-').to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn form(name: &str) -> BadgeForm {
        BadgeForm {
            action: "save".into(),
            id: String::new(),
            name: name.into(),
            description: "Trusted tester".into(),
            icon_url: "https://cdn.example/badge.svg".into(),
            color: "#A855F7".into(),
            sort_order: 4,
            enabled: Some("on".into()),
            assigned_user_ids: String::new(),
        }
    }

    #[test]
    fn validates_and_normalizes_badges() {
        let badge = validate_badge(form("Signal Hero")).unwrap();
        assert_eq!(badge.id, "signal-hero");
        assert_eq!(badge.color, "#a855f7");
        assert!(badge.enabled);
        assert!(badge.assigned_user_ids.is_empty());
    }

    #[test]
    fn rejects_unsafe_icon_urls() {
        let mut bad = form("Unsafe");
        bad.icon_url = "javascript:alert(1)".into();
        assert!(validate_badge(bad).is_err());
    }

    #[test]
    fn parses_assigned_user_ids() {
        let mut assigned = form("Signal Hero");
        assigned.assigned_user_ids = "alice, bob\nalice;carol_1".into();
        let badge = validate_badge(assigned).unwrap();
        assert_eq!(badge.assigned_user_ids, vec!["alice", "bob", "carol_1"]);
    }

    #[test]
    fn rejects_unsafe_assigned_user_ids() {
        let mut assigned = form("Signal Hero");
        assigned.assigned_user_ids = "alice, <script>".into();
        assert!(validate_badge(assigned).is_err());
    }
}
