// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::types::FlashMessage,
    config::AdminConfig,
    middleware::auth::AuthContext,
    routes::custom_badges::CustomBadge,
    templates::{
        components::{error_display::error_alert, form::{FORM_INPUT_CLASS, FORM_LABEL_CLASS, FORM_TEXTAREA_CLASS, csrf_input, danger_button, submit_button}, page_container::page_header_full},
        layout::{LayoutOptions, admin_layout_ext},
    },
};
use maud::{Markup, html};

pub fn custom_badges_page(
    config: &AdminConfig,
    auth: &AuthContext,
    badges: &[CustomBadge],
    error: Option<&str>,
    csrf_token: &str,
    flash: Option<&FlashMessage>,
    can_update: bool,
) -> Markup {
    let base = &config.base_path;
    let content = html! {
        (page_header_full(
            "Custom Badge Studio",
            Some("Create branded profile badge definitions with safe icons, colors, ordering, and visibility."),
            None, None, None, html! {},
        ))
        @if let Some(error) = error { (error_alert(error)) }

        div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]" {
            section class="space-y-4" aria-labelledby="badge-catalogue-title" {
                div class="flex items-center justify-between" {
                    h2 id="badge-catalogue-title" class="text-lg font-semibold text-neutral-900" { "Badge catalogue" }
                    span class="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600" { (badges.len()) " badges" }
                }
                @if badges.is_empty() {
                    div class="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center" {
                        p class="font-medium text-neutral-800" { "No custom badges yet" }
                        p class="mt-1 text-sm text-neutral-500" { "Use the studio form to create the first one." }
                    }
                }
                @for badge in badges {
                    article class="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" style={"border-left: 4px solid " (badge.color)} {
                        div class="flex items-start gap-4" {
                            div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={"background: " (badge.color) "18"} {
                                img src=(badge.icon_url) alt="" class="h-8 w-8 object-contain" loading="lazy" referrerpolicy="no-referrer";
                            }
                            div class="min-w-0 flex-1" {
                                div class="flex flex-wrap items-center gap-2" {
                                    h3 class="font-semibold text-neutral-900" { (badge.name) }
                                    code class="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600" { (badge.id) }
                                    @if badge.enabled { span class="text-xs font-medium text-green-700" { "Enabled" } }
                                    @else { span class="text-xs font-medium text-neutral-500" { "Disabled" } }
                                }
                                @if !badge.description.is_empty() { p class="mt-1 text-sm text-neutral-600" { (badge.description) } }
                                p class="mt-2 text-xs text-neutral-400" { "Order: " (badge.sort_order) " · Assigned: " (badge.assigned_user_ids.len()) }
                            }
                            @if can_update {
                                form method="post" action={(base) "/custom-badges"} onsubmit="return confirm('Delete this custom badge?')" {
                                    (csrf_input(csrf_token))
                                    input type="hidden" name="action" value="delete";
                                    input type="hidden" name="id" value=(badge.id);
                                    (danger_button("Delete"))
                                }
                            }
                        }
                    }
                }
            }

            aside class="xl:sticky xl:top-6 xl:self-start" {
                div class="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm" {
                    h2 class="text-lg font-semibold text-neutral-900" { "Create or update badge" }
                    p class="mt-1 text-sm text-neutral-500" { "Use an existing ID to update a badge without breaking assignments." }
                    form id="badge-studio-form" method="post" action={(base) "/custom-badges"} class="mt-5 space-y-4" {
                        (csrf_input(csrf_token))
                        input type="hidden" name="action" value="save";
                        div { label class=(FORM_LABEL_CLASS) for="id" { "Badge ID" } input class=(FORM_INPUT_CLASS) id="id" name="id" maxlength="64" pattern="[a-z0-9-]+" placeholder="auto-generated-from-name"; }
                        div { label class=(FORM_LABEL_CLASS) for="name" { "Display name *" } input class=(FORM_INPUT_CLASS) id="name" name="name" required maxlength="48" placeholder="Aether Guardian"; }
                        div { label class=(FORM_LABEL_CLASS) for="description" { "Description" } textarea class=(FORM_TEXTAREA_CLASS) id="description" name="description" maxlength="160" rows="3" placeholder="Awarded for protecting the network" {} }
                        div { label class=(FORM_LABEL_CLASS) for="icon_url" { "Icon URL *" } input class=(FORM_INPUT_CLASS) type="url" id="icon_url" name="icon_url" required maxlength="2048" placeholder="https://cdn.example/badge.svg"; p class="mt-1 text-xs text-neutral-500" { "HTTPS, a local /path, or an inline SVG data URL." } }
                        div { label class=(FORM_LABEL_CLASS) for="assigned_user_ids" { "Assigned user IDs" } input class=(FORM_INPUT_CLASS) id="assigned_user_ids" name="assigned_user_ids" maxlength="8000" placeholder="alice, bob"; p class="mt-1 text-xs text-neutral-500" { "Comma-separated user IDs. Empty means unassigned." } }
                        div class="grid grid-cols-2 gap-3" {
                            div { label class=(FORM_LABEL_CLASS) for="color" { "Accent" } input class="h-10 w-full cursor-pointer rounded-lg border border-neutral-300 p-1" type="color" id="color" name="color" value="#7c3aed"; }
                            div { label class=(FORM_LABEL_CLASS) for="sort_order" { "Order" } input class=(FORM_INPUT_CLASS) type="number" id="sort_order" name="sort_order" value="0" min="-10000" max="10000"; }
                        }
                        label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700" { input type="checkbox" name="enabled" checked; "Enabled" }
                        div class="rounded-xl border border-neutral-200 bg-neutral-950 p-4" {
                            p class="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400" { "Live preview" }
                            div class="flex items-center gap-3" {
                                span id="badge-preview-icon-wrap" class="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15" { img id="badge-preview-icon" alt="" class="h-7 w-7 object-contain"; }
                                div { strong id="badge-preview-name" class="block text-sm text-white" { "Aether Guardian" } span id="badge-preview-description" class="block text-xs text-neutral-400" { "Custom AETHERNET badge" } }
                            }
                        }
                        @if can_update { (submit_button("Save badge")) }
                        @else { p class="text-sm text-amber-700" { "You have read-only access." } }
                    }
                }
            }
        }
    };
    let script = r#"
const form=document.getElementById('badge-studio-form');
if(form){const sync=()=>{const name=form.elements.name.value||'Aether Guardian';const description=form.elements.description.value||'Custom AETHERNET badge';const icon=form.elements.icon_url.value;const color=form.elements.color.value||'#7c3aed';document.getElementById('badge-preview-name').textContent=name;document.getElementById('badge-preview-description').textContent=description;const image=document.getElementById('badge-preview-icon');image.src=icon;image.style.display=icon?'block':'none';document.getElementById('badge-preview-icon-wrap').style.background=color+'26';};form.addEventListener('input',sync);sync();}
"#;
    admin_layout_ext(config, auth, "Custom Badges", "custom-badges", flash, content, LayoutOptions { csrf_token, extra_scripts: Some(script), ..LayoutOptions::default() })
}
