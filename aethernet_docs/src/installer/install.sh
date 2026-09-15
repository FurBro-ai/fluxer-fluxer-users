#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Aethernet self-hosting installer and upgrader for Linux and macOS.
#
# Three modes, one file:
#
#   default     Check the host, download the stack files, write .env with every
#               value the stack requires, start the containers.
#   --update    Upgrade an instance that already exists. Record the running
#               images, back up, refresh the stack files, pull, recreate, verify.
#   --rollback  Put the images and the stack files of the last recorded upgrade
#               back.
#
# Why one script and not a separate upgrader: an upgrade needs the host checks,
# the stack download, the readiness poll and the health probe that the install
# already carries. A second script either copies them or drifts from them, and
# the operator has two downloads and two checksums to verify instead of one.
# The modes share one contract, one digest and one set of exit codes.
#
# This file is also the procedure. Every step of the upgrade carries the command
# an operator types to do that step by hand, and the reason the step exists.
#
# Read this file before you run it. The default mode writes .env, which holds
# every secret the instance has. The upgrade generates a secret only for a key
# the refreshed stack requires that .env does not hold, and rewrites no
# secret. The only value either upgrade mode ever replaces in .env is
# AETHERNET_IMAGE_TAG, and only during a rollback that moves off a pinned tag.
#
# Rewriting a secret in .env against volumes that already exist is the one thing
# this script could do that an operator cannot undo. A fresh POSTGRES_PASSWORD
# does not open the existing postgres-data volume, and the instance never starts
# again. Every path below is built so that no run can reach that state.
#
# Exit codes:
#   0    success
#   1    usage error
#   2    unmet prerequisite
#   3    refused to overwrite existing state
#   4    a download failed
#   5    secret generation failed
#   6    the stack did not come up
#   7    a backup failed
#   130  interrupted

set -eu

# The C locale keeps the character ranges in the validation patterns byte based.
# Under a UTF-8 locale a-z also matches uppercase and accented letters.
LC_ALL=C
export LC_ALL

AETHERNET_RAW_BASE='https://raw.githubusercontent.com/aethernetapp/aethernet'
AETHERNET_STACK_PATH='deploy/self-hosting'
AETHERNET_MIN_ENGINE='24.0.0'
# Podman numbers its releases on its own scale, so the Docker Engine floor says
# nothing about it. 5.0 is the first release that runs this stack's compose file
# as written, healthcheck conditions and all.
AETHERNET_MIN_PODMAN='5.0.0'
AETHERNET_MIN_COMPOSE='2.20.2'
# Both overlays this script downloads use the !override tag, which Compose learned
# in 2.24.4. A stack that loads neither runs on the lower minimum, so the higher
# one is required only once COMPOSE_FILE names more than one file.
AETHERNET_MIN_COMPOSE_OVERLAY='2.24.4'
AETHERNET_READY_TIMEOUT=600
AETHERNET_READY_INTERVAL=5
AETHERNET_VAPID_ATTEMPTS=8
AETHERNET_SEC1_HEADER='30770201010420'
AETHERNET_INSPECT_FORMAT='{{index .Config.Labels "com.docker.compose.service"}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} {{.State.ExitCode}}'

# The image that copies volumes and measures them. Pinned, because an upgrade
# that reaches for a moving tag to take its backup has one more thing that can
# change under it.
AETHERNET_HELPER_IMAGE='alpine:3.22'

# Names inside a record directory. A record is one upgrade: what was running,
# what the stack files said, and the backup taken before the images moved.
AETHERNET_RECORD_PREFIX='record-'
AETHERNET_IMAGES_FILE='images'
AETHERNET_TAG_FILE='image-tag'
AETHERNET_DUMP_FILE='aethernet.dump'

# Free space demanded before a volume copy, as a percentage of the measured
# volume size. The tarball compresses, so this is generous on purpose. A backup
# that fills the disk it writes to takes the instance down with it.
AETHERNET_VOLUME_HEADROOM=110

# The keys .env carries, in the order they are written. The installer iterates
# these two lists, so a key that leaves a list is a key the installer stops
# writing. The docs CI parses the same text and compares it against
# deploy/self-hosting/.env.example.

aethernet_non_secret_keys() {
	cat <<'KEYS'
AETHERNET_DOMAIN domain
AETHERNET_PUBLIC_SCHEME literal https
AETHERNET_PUBLIC_PORT literal 443
AETHERNET_VAPID_EMAIL email
AETHERNET_IMAGE_TAG image_tag
AETHERNET_S3_ACCESS_KEY literal aethernet
LIVEKIT_API_KEY literal aethernet
KEYS
}

aethernet_secret_keys() {
	cat <<'KEYS'
POSTGRES_PASSWORD hex
MEILI_MASTER_KEY hex
AETHERNET_S3_SECRET_KEY hex
AETHERNET_SUDO_MODE_SECRET hex
AETHERNET_CONNECTION_INITIATION_SECRET hex
AETHERNET_GATEWAY_RPC_AUTH_TOKEN hex
AETHERNET_ERLANG_COOKIE hex
AETHERNET_MEDIA_PROXY_SECRET_KEY hex
AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 base64
AETHERNET_ADMIN_SECRET_KEY_BASE hex
AETHERNET_ADMIN_OAUTH_CLIENT_SECRET hex
LIVEKIT_API_SECRET hex
AETHERNET_VAPID_PUBLIC_KEY vapid_public
AETHERNET_VAPID_PRIVATE_KEY vapid_private
KEYS
}

aethernet_stack_files() {
	cat <<'FILES'
docker-compose.yml
docker-compose.proxy.yml
tunnel.compose.yml
Caddyfile
.env.example
FILES
}

aethernet_compose_names() {
	cat <<'NAMES'
compose.yaml
compose.yml
docker-compose.yml
docker-compose.yaml
NAMES
}

aethernet_compose_name_in() {
	for aethernet_candidate in $(aethernet_compose_names); do
		if [ -e "$1/$aethernet_candidate" ]; then
			printf '%s' "$aethernet_candidate"
			return 0
		fi
	done
	return 1
}

aethernet_compose_base='docker-compose.yml'
aethernet_compose_base_from=''

aethernet_placed_name() {
	if [ "$1" = 'docker-compose.yml' ]; then
		printf '%s' "$aethernet_compose_base"
	else
		printf '%s' "$1"
	fi
}

# The file Compose bind-mounts from the working directory, with the service that
# mounts it.
#
# Compose decides whether to recreate a container by comparing its configuration.
# The contents of a bind-mounted file are not part of that comparison, so a
# changed Caddyfile survives docker compose up -d with the old bytes still loaded
# in the running container. The service has to be restarted by name.
#
# By hand, after a refresh that changed the file:
#   docker compose restart edge
aethernet_mounted_files() {
	cat <<'MOUNTS'
Caddyfile edge
MOUNTS
}

# The volumes an upgrade copies, and the reason the rest are absent.
#
# postgres-data is not here because the dump supersedes it. A custom-format dump
# restores into the major version that wrote it or a newer one, a tarball of the
# data directory restores only into the major that wrote it, and taking both
# doubles the downtime and the disk for a strictly weaker artifact.
#
# valkey-data and nats-data hold queued work, not records. Losing them drops
# scheduled bulk deletions and background jobs, which is degradation rather than
# loss, and the upgrade never removes a volume, so nothing here can lose them.
#
# meilisearch-data rebuilds on the next API start, edge-data is one certificate
# request, edge-config is rewritten by Caddy on every start.
#
# seaweedfs-data is the one that matters. It holds every upload, avatar, report
# and harvest, and nothing else in the stack can recreate any of it.
aethernet_backup_volumes() {
	cat <<'VOLUMES'
seaweedfs-data
VOLUMES
}

aethernet_usage() {
	cat <<'USAGE'
Usage: sh install.sh --domain <host> --email <address> [options]
       sh install.sh --update [options]
       sh install.sh --rollback [options]

Options:
  --domain <host>          Hostname the instance answers on. Prompted when absent.
  --email <address>        Address the operator reads. Prompted when absent.
  --engine <command>       Container engine to drive. Default docker, or podman
                           when docker is absent.
  --dir <path>             Working directory. Default ~/aethernet, or the working
                           directory itself when --update or --rollback is given
                           and it holds an instance.
  --ref <git ref>          Ref the stack files come from. Default: the image tag,
                           and main when that tag is v1 or latest.
  --image-tag <tag>        Image tag the stack runs. Default v1.
  --tls bundled|proxy      Certificate mode. Default bundled.
  --edge-bind <addr:port>  Plain HTTP bind under --tls proxy. Default 127.0.0.1:8080.
  --non-interactive        Never prompt. A missing required value is an error.
  --dry-run                Print the plan. Change nothing.
  --no-start               Write everything and skip $aethernet_engine compose up -d.
  --update                 Upgrade: record, back up, refresh, pull, recreate, verify.
  --rollback               Restore the images and stack files of the last record.
  --backup-dir <path>      Where records go. Default <dir>/backups.
  --no-volume-backup       Take the database dump and skip the uploads copy.
  --skip-backup-accept-data-loss
                           Upgrade with no backup at all. Losable data is lost.
  --allow-root             Permit running as root.
  --help                   Print this text.
USAGE
}

aethernet_say() {
	printf '%s\n' "$1"
}

aethernet_fail() {
	printf '%s\n' "$2" >&2
	exit "$1"
}

aethernet_bad_usage() {
	printf '%s\n\n' "$1" >&2
	aethernet_usage >&2
	exit 1
}

aethernet_take_value() {
	if [ "$2" -lt 2 ]; then
		aethernet_bad_usage "$1 needs a value."
	fi
	case $3 in
		''|--*) aethernet_bad_usage "$1 needs a value." ;;
	esac
}

aethernet_scratch=''
aethernet_record=''

aethernet_cleanup() {
	if [ -n "$aethernet_scratch" ] && [ -d "$aethernet_scratch" ]; then
		rm -rf "$aethernet_scratch"
	fi
}

aethernet_on_signal() {
	aethernet_cleanup
	if [ -n "$aethernet_record" ] && [ -d "$aethernet_record" ]; then
		printf 'Interrupted. The backup and the version record are in %s.\n' "$aethernet_record" >&2
	else
		printf 'Interrupted. The stack files and .env are left as they were.\n' >&2
	fi
	exit 130
}

trap aethernet_cleanup EXIT
trap aethernet_on_signal INT
trap aethernet_on_signal HUP
trap aethernet_on_signal TERM

opt_domain=''
opt_email=''
opt_dir=''
opt_engine=''
aethernet_engine='docker'
aethernet_engine_label='Docker Engine'
opt_ref=''
opt_image_tag='v1'
opt_tls='bundled'
opt_edge_bind='127.0.0.1:8080'
opt_non_interactive=0
opt_dry_run=0
opt_no_start=0
opt_update=0
opt_rollback=0
opt_backup_dir=''
opt_no_volume_backup=0
opt_skip_backup=0
opt_allow_root=0

while [ $# -gt 0 ]; do
	case $1 in
		--domain)
			aethernet_take_value '--domain' $# "${2:-}"
			opt_domain=$2
			shift 2
			;;
		--email)
			aethernet_take_value '--email' $# "${2:-}"
			opt_email=$2
			shift 2
			;;
		--engine)
			aethernet_take_value '--engine' $# "${2:-}"
			opt_engine=$2
			shift 2
			;;
		--dir)
			aethernet_take_value '--dir' $# "${2:-}"
			opt_dir=$2
			shift 2
			;;
		--ref)
			aethernet_take_value '--ref' $# "${2:-}"
			opt_ref=$2
			shift 2
			;;
		--image-tag)
			aethernet_take_value '--image-tag' $# "${2:-}"
			opt_image_tag=$2
			shift 2
			;;
		--tls)
			aethernet_take_value '--tls' $# "${2:-}"
			opt_tls=$2
			shift 2
			;;
		--edge-bind)
			aethernet_take_value '--edge-bind' $# "${2:-}"
			opt_edge_bind=$2
			shift 2
			;;
		--backup-dir)
			aethernet_take_value '--backup-dir' $# "${2:-}"
			opt_backup_dir=$2
			shift 2
			;;
		--non-interactive)
			opt_non_interactive=1
			shift
			;;
		--dry-run)
			opt_dry_run=1
			shift
			;;
		--no-start)
			opt_no_start=1
			shift
			;;
		--update)
			opt_update=1
			shift
			;;
		--rollback)
			opt_rollback=1
			shift
			;;
		--no-volume-backup)
			opt_no_volume_backup=1
			shift
			;;
		--skip-backup-accept-data-loss)
			opt_skip_backup=1
			shift
			;;
		--allow-root)
			opt_allow_root=1
			shift
			;;
		--help)
			aethernet_usage
			exit 0
			;;
		*)
			aethernet_bad_usage "Unknown option $1."
			;;
	esac
done

# An upgrade acts on an instance that already exists, and the directory holding
# one is recognisable: a compose file with content, an .env beside it, and at
# least one AETHERNET_ key in that .env. Taking the working directory when it holds
# those is what an operator standing in their own instance means, and it is the
# only case where the default is not ~/aethernet.
#
# The AETHERNET_ test is what keeps this off somebody else's stack. A compose file
# and an .env together describe every Compose project there is, and an upgrade
# replaces the stack files in the directory it acts on, so a looser test would
# overwrite a project that has nothing to do with Aethernet.
#
# An install writes a new instance, so it never adopts the working directory.
if [ -z "$opt_dir" ]; then
	aethernet_here_compose=$(aethernet_compose_name_in "$(pwd)" || true)
	if { [ "$opt_update" -eq 1 ] || [ "$opt_rollback" -eq 1 ]; } &&
		[ -n "$aethernet_here_compose" ] && [ -s "$(pwd)/$aethernet_here_compose" ] &&
		[ -e "$(pwd)/.env" ] && grep -q '^AETHERNET_' "$(pwd)/.env" 2>/dev/null; then
		opt_dir="$(pwd)"
		aethernet_say "Acting on the instance in $opt_dir, the working directory. Pass --dir to name another."
	else
		if [ -n "${HOME:-}" ]; then
			opt_dir="$HOME/aethernet"
		else
			opt_dir="$(pwd)/aethernet"
		fi
		if [ "$opt_update" -eq 1 ] || [ "$opt_rollback" -eq 1 ]; then
			aethernet_say "The working directory holds no instance, so this acts on $opt_dir. Pass --dir to name another."
		fi
	fi
fi
case $opt_dir in
	/*) ;;
	*) opt_dir="$(pwd)/$opt_dir" ;;
esac

if [ -z "$opt_backup_dir" ]; then
	opt_backup_dir="$opt_dir/backups"
fi
case $opt_backup_dir in
	/*) ;;
	*) opt_backup_dir="$(pwd)/$opt_backup_dir" ;;
esac

aethernet_docker_hint() {
	if [ "$(uname -s)" = 'Darwin' ]; then
		printf '%s' 'Install Docker Desktop from https://docs.docker.com/desktop/setup/install/mac-install/.'
		return 0
	fi
	if command -v apt-get >/dev/null 2>&1; then
		printf '%s' 'On Debian and Ubuntu, follow https://docs.docker.com/engine/install/ and install docker-ce with docker-compose-plugin. The distribution docker.io package ships no Compose plugin.'
		return 0
	fi
	if command -v dnf >/dev/null 2>&1; then
		printf '%s' 'On Fedora, RHEL and derivatives, follow https://docs.docker.com/engine/install/ and install docker-ce with docker-compose-plugin.'
		return 0
	fi
	if command -v zypper >/dev/null 2>&1; then
		printf '%s' 'On openSUSE, install the docker and docker-compose packages with zypper, then enable the docker service.'
		return 0
	fi
	if command -v pacman >/dev/null 2>&1; then
		printf '%s' 'On Arch Linux, install the docker and docker-compose packages with pacman, then enable the docker service.'
		return 0
	fi
	if command -v apk >/dev/null 2>&1; then
		printf '%s' 'On Alpine Linux, install the docker and docker-cli-compose packages with apk, then enable the docker service.'
		return 0
	fi
	printf '%s' 'Follow https://docs.docker.com/engine/install/ for this distribution.'
}

aethernet_host_tool_hint() {
	if [ "$(uname -s)" = 'Darwin' ]; then
		printf '%s' "Install $1 with Homebrew."
		return 0
	fi
	if command -v apt-get >/dev/null 2>&1; then
		printf '%s' "Install it with apt-get install -y $1."
		return 0
	fi
	if command -v dnf >/dev/null 2>&1; then
		printf '%s' "Install it with dnf install -y $1."
		return 0
	fi
	if command -v zypper >/dev/null 2>&1; then
		printf '%s' "Install it with zypper install -y $1."
		return 0
	fi
	if command -v pacman >/dev/null 2>&1; then
		printf '%s' "Install it with pacman -S $1."
		return 0
	fi
	if command -v apk >/dev/null 2>&1; then
		printf '%s' "Install it with apk add $1."
		return 0
	fi
	printf '%s' "Install $1 with the package manager of this distribution."
}

aethernet_version_field() {
	printf '%s' "$1" | cut -d. -f"$2"
}

aethernet_version_ge() {
	aethernet_vg_index=1
	while [ "$aethernet_vg_index" -le 3 ]; do
		aethernet_vg_left=$(aethernet_version_field "$1" "$aethernet_vg_index")
		aethernet_vg_right=$(aethernet_version_field "$2" "$aethernet_vg_index")
		case $aethernet_vg_left in
			''|*[!0-9]*) aethernet_vg_left=0 ;;
		esac
		case $aethernet_vg_right in
			''|*[!0-9]*) aethernet_vg_right=0 ;;
		esac
		if [ "$aethernet_vg_left" -gt "$aethernet_vg_right" ]; then
			return 0
		fi
		if [ "$aethernet_vg_left" -lt "$aethernet_vg_right" ]; then
			return 1
		fi
		aethernet_vg_index=$((aethernet_vg_index + 1))
	done
	return 0
}

aethernet_engine_version=''
aethernet_compose_version=''

# Every engine that speaks the Docker CLI reports itself as "<name> version X".
# Docker says "Docker version 28.0.0, build ...", Podman says "podman version
# 5.8.4", and the podman-docker shim answers as Podman under the name docker.
# Reading the name as well as the number is what lets the floor below belong to
# the engine actually in use, because Podman's 5.x is not Docker's 5.x.
aethernet_resolve_engine() {
	if [ -n "$opt_engine" ]; then
		aethernet_engine=$opt_engine
	elif command -v docker >/dev/null 2>&1; then
		aethernet_engine='docker'
	elif command -v podman >/dev/null 2>&1; then
		aethernet_engine='podman'
	else
		aethernet_fail 2 "Neither docker nor podman is installed. $(aethernet_docker_hint)"
	fi
	if ! command -v "$aethernet_engine" >/dev/null 2>&1; then
		aethernet_fail 2 "$aethernet_engine is not installed. Pass --engine with the command that drives your containers."
	fi
}

aethernet_preflight() {
	if [ "$opt_allow_root" -eq 0 ] && [ "$(id -u)" -eq 0 ]; then
		aethernet_fail 2 'Running as root. Use an account in the docker group, or pass --allow-root.'
	fi
	aethernet_resolve_engine
	if ! $aethernet_engine compose version >/dev/null 2>&1; then
		aethernet_fail 2 "$aethernet_engine has no compose subcommand. $(aethernet_docker_hint)"
	fi
	aethernet_engine_report=$($aethernet_engine --version 2>/dev/null)
	aethernet_engine_kind=$(printf '%s\n' "$aethernet_engine_report" | sed -n 's/^\([A-Za-z][A-Za-z]*\) version .*/\1/p' | tr 'A-Z' 'a-z')
	aethernet_engine_version=$(printf '%s\n' "$aethernet_engine_report" | sed -n 's/^[A-Za-z][A-Za-z]* version v\{0,1\}\([0-9][0-9.]*\).*/\1/p')
	aethernet_compose_version=$($aethernet_engine compose version --short 2>/dev/null | sed -n 's/^v\{0,1\}\([0-9][0-9.]*\).*/\1/p')
	if [ -z "$aethernet_engine_version" ] || [ -z "$aethernet_compose_version" ]; then
		aethernet_fail 2 "Cannot read the engine and Compose versions from $aethernet_engine. It answered \"$aethernet_engine_report\" to --version."
	fi
	case $aethernet_engine_kind in
		podman)
			aethernet_engine_label='Podman'
			aethernet_min_engine=$AETHERNET_MIN_PODMAN
			;;
		*)
			aethernet_engine_label='Docker Engine'
			aethernet_min_engine=$AETHERNET_MIN_ENGINE
			;;
	esac
	if ! aethernet_version_ge "$aethernet_engine_version" "$aethernet_min_engine"; then
		aethernet_fail 2 "$aethernet_engine_label $aethernet_engine_version with Compose $aethernet_compose_version. Aethernet needs $aethernet_engine_label $aethernet_min_engine or newer."
	fi
	if ! aethernet_version_ge "$aethernet_compose_version" "$AETHERNET_MIN_COMPOSE"; then
		aethernet_fail 2 "$aethernet_engine_label $aethernet_engine_version with Compose $aethernet_compose_version. Aethernet needs Compose $AETHERNET_MIN_COMPOSE or newer."
	fi
	if ! $aethernet_engine info >/dev/null 2>&1; then
		aethernet_fail 2 "$aethernet_engine does not answer. Start it and run this again."
	fi
	if ! command -v curl >/dev/null 2>&1; then
		aethernet_fail 2 "curl is not installed. $(aethernet_host_tool_hint curl)"
	fi
	if ! command -v openssl >/dev/null 2>&1; then
		aethernet_fail 2 "openssl is not installed. $(aethernet_host_tool_hint openssl)"
	fi
	aethernet_say "$aethernet_engine_label $aethernet_engine_version with Compose $aethernet_compose_version."
}

aethernet_valid_domain() {
	case $1 in
		''|*[!a-z0-9.-]*) return 1 ;;
		.*|-*|*.|*-) return 1 ;;
		*..*) return 1 ;;
	esac
	case $1 in
		*.*) return 0 ;;
	esac
	return 1
}

aethernet_valid_email() {
	case $1 in
		*@*@*) return 1 ;;
		@*|*@) return 1 ;;
		*' '*) return 1 ;;
		*@*) return 0 ;;
	esac
	return 1
}

aethernet_valid_edge_bind() {
	case $1 in
		*:*) ;;
		*) return 1 ;;
	esac
	aethernet_bind_port=${1##*:}
	aethernet_bind_host=${1%:*}
	case $aethernet_bind_port in
		''|*[!0-9]*) return 1 ;;
	esac
	case $aethernet_bind_host in
		''|*' '*) return 1 ;;
	esac
	return 0
}

aethernet_prompt() {
	aethernet_prompt_label=$1
	aethernet_prompt_tries=0
	aethernet_prompt_value=''
	while [ "$aethernet_prompt_tries" -lt 3 ]; do
		printf '%s: ' "$aethernet_prompt_label" >&2
		if ! read -r aethernet_prompt_value; then
			return 1
		fi
		if [ -n "$aethernet_prompt_value" ]; then
			return 0
		fi
		aethernet_prompt_tries=$((aethernet_prompt_tries + 1))
	done
	return 1
}

aethernet_resolve_values() {
	if [ "$opt_update" -eq 1 ] || [ "$opt_rollback" -eq 1 ]; then
		return 0
	fi
	if [ -z "$opt_domain" ]; then
		if [ "$opt_non_interactive" -eq 1 ] || [ "$opt_dry_run" -eq 1 ] || [ ! -t 0 ]; then
			aethernet_bad_usage '--domain is required.'
		fi
		aethernet_prompt 'Hostname the instance answers on' || aethernet_fail 1 'No hostname given.'
		opt_domain=$aethernet_prompt_value
	fi
	if [ -z "$opt_email" ]; then
		if [ "$opt_non_interactive" -eq 1 ] || [ "$opt_dry_run" -eq 1 ] || [ ! -t 0 ]; then
			aethernet_bad_usage '--email is required.'
		fi
		aethernet_prompt 'Address you read' || aethernet_fail 1 'No address given.'
		opt_email=$aethernet_prompt_value
	fi
	aethernet_valid_domain "$opt_domain" || aethernet_bad_usage "--domain $opt_domain is not a lowercase hostname. Give a bare hostname such as chat.example.com."
	aethernet_valid_email "$opt_email" || aethernet_bad_usage "--email $opt_email is not an address."
}

aethernet_validate_options() {
	case $opt_tls in
		bundled|proxy) ;;
		*) aethernet_bad_usage "--tls takes bundled or proxy, not $opt_tls." ;;
	esac
	case $opt_ref in
		*' '*|*/../*|../*|*/..) aethernet_bad_usage "--ref $opt_ref is not a git ref." ;;
	esac
	case $opt_image_tag in
		''|*' '*|*/*) aethernet_bad_usage "--image-tag $opt_image_tag is not an image tag." ;;
	esac
	if [ "$opt_tls" = 'proxy' ]; then
		aethernet_valid_edge_bind "$opt_edge_bind" || aethernet_bad_usage "--edge-bind $opt_edge_bind is not an address and port."
	fi
	if [ "$opt_update" -eq 1 ] && [ "$opt_rollback" -eq 1 ]; then
		aethernet_bad_usage '--update and --rollback do not combine.'
	fi
	if [ "$opt_no_start" -eq 1 ] && { [ "$opt_update" -eq 1 ] || [ "$opt_rollback" -eq 1 ]; }; then
		aethernet_bad_usage '--no-start belongs to an install. An upgrade that does not recreate is not an upgrade.'
	fi
	if [ "$opt_skip_backup" -eq 1 ] && [ "$opt_update" -eq 0 ]; then
		aethernet_bad_usage '--skip-backup-accept-data-loss belongs to --update.'
	fi
	if [ "$opt_no_volume_backup" -eq 1 ] && [ "$opt_update" -eq 0 ]; then
		aethernet_bad_usage '--no-volume-backup belongs to --update.'
	fi
	if [ "$opt_skip_backup" -eq 1 ] && [ "$opt_no_volume_backup" -eq 1 ]; then
		aethernet_bad_usage '--skip-backup-accept-data-loss already skips the volume copy.'
	fi
}

aethernet_ref_for_tag() {
	case $1 in
		v1|latest) printf 'main' ;;
		*) printf '%s' "$1" ;;
	esac
}

# The images come from AETHERNET_IMAGE_TAG and the stack files come from a git ref.
# A release tags its images and its commit with the same CalVer string, so a
# pinned tag names the commit that carries its compose files. The moving tags v1
# and latest track main.
aethernet_resolve_ref() {
	[ -z "$opt_ref" ] || return 0
	if [ "$opt_update" -eq 1 ] || [ "$opt_rollback" -eq 1 ]; then
		opt_ref=$(aethernet_ref_for_tag "$(aethernet_env_value AETHERNET_IMAGE_TAG)")
	else
		opt_ref=$(aethernet_ref_for_tag "$opt_image_tag")
	fi
	if [ -z "$opt_ref" ]; then
		aethernet_fail 3 "$opt_dir/.env declares no AETHERNET_IMAGE_TAG, so no ref can be derived. Pass --ref."
	fi
	case $opt_ref in
		*' '*|*/../*|../*|*/..) aethernet_fail 3 "AETHERNET_IMAGE_TAG is $opt_ref, which is not a git ref. Pass --ref." ;;
	esac
}

aethernet_print_plan() {
	aethernet_say 'Plan:'
	aethernet_say "  directory     $opt_dir"
	aethernet_say "  ref           $opt_ref"
	aethernet_say "  image tag     $opt_image_tag"
	aethernet_say "  tls           $opt_tls"
	if [ "$opt_tls" = 'proxy' ]; then
		aethernet_say "  edge bind     $opt_edge_bind"
	fi
	aethernet_say "  domain        $opt_domain"
	aethernet_say "  email         $opt_email"
	aethernet_say '  action        download the stack files, write .env, start the stack'
	aethernet_say "  .env keys     $(aethernet_non_secret_keys | wc -l | tr -d ' ') non-secret values and $(aethernet_secret_keys | wc -l | tr -d ' ') secrets"
	aethernet_say '  files         docker-compose.yml docker-compose.proxy.yml tunnel.compose.yml Caddyfile .env.example'
	if [ -e "$opt_dir/.env" ]; then
		aethernet_say "  note          $opt_dir/.env exists. A run without --update refuses it."
	fi
	aethernet_say 'Nothing is written. Drop --dry-run to run this.'
}

# The scratch directory sits beside the files it will become, so the rename that
# puts a downloaded file in place is a rename within one filesystem and cannot
# leave a half-written file behind. The dry run passes a temporary parent
# instead, because it renames nothing.
aethernet_open_scratch() {
	mkdir -p "$1"
	aethernet_scratch="$1/.aethernet-install.$$"
	rm -rf "$aethernet_scratch"
	mkdir -m 700 "$aethernet_scratch"
}

# By hand, for one file:
#   curl -fsSL https://raw.githubusercontent.com/aethernetapp/aethernet/main/deploy/self-hosting/docker-compose.yml -o docker-compose.yml
#
# The files come from a git ref and the images come from AETHERNET_IMAGE_TAG. The
# ref is derived from the tag unless --ref names one, which is the pairing rule
# that stops a compose file from asking for a variable the running images do not
# read, or from pinning a service image the release never built.
aethernet_fetch_stack() {
	aethernet_say "Downloading the stack files from ref $opt_ref."
	aethernet_stack_files > "$aethernet_scratch/files"
	while read -r aethernet_file; do
		[ -n "$aethernet_file" ] || continue
		aethernet_part="$aethernet_scratch/$aethernet_file.part"
		if ! curl -fsSL --proto '=https' --tlsv1.2 -o "$aethernet_part" "$AETHERNET_RAW_BASE/$opt_ref/$AETHERNET_STACK_PATH/$aethernet_file"; then
			aethernet_fail 4 "Download failed for $aethernet_file at ref $opt_ref. Pass --ref to name the ref the stack files come from."
		fi
		if [ ! -s "$aethernet_part" ]; then
			aethernet_fail 4 "Downloaded $aethernet_file is empty."
		fi
		if [ "$aethernet_file" = 'docker-compose.yml' ] && ! grep -q '^services:' "$aethernet_part"; then
			aethernet_fail 4 "The docker-compose.yml downloaded from $opt_ref holds no services block."
		fi
	done < "$aethernet_scratch/files"
}

# Every file lands only after all of them arrive, so a failed download leaves the
# directory on the set it already had.
#
# None of these files is part of an image, and all four are read from the working
# directory, so docker compose pull never updates any of them. That is why an
# upgrade refreshes them itself.
#
# A refreshed docker-compose.yml can declare a variable the running .env does not
# carry. Compose writes ${NAME:?message} for a variable the stack requires and
# stops with that message until .env sets it, and ${NAME:-default} for one that
# needs nothing from the operator. Every optional override ships commented out in
# .env.example, so a new required key is the only kind that asks for an edit.
aethernet_place_stack() {
	while read -r aethernet_file; do
		[ -n "$aethernet_file" ] || continue
		mv "$aethernet_scratch/$aethernet_file.part" "$opt_dir/$(aethernet_placed_name "$aethernet_file")"
	done < "$aethernet_scratch/files"
	aethernet_say "Stack files in $opt_dir are at ref $opt_ref."
}

aethernet_compose_project() {
	if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
		printf '%s' "$COMPOSE_PROJECT_NAME"
		return 0
	fi
	sed -n 's/^name: *//p' "$opt_dir/$aethernet_compose_base" | head -n 1
}

aethernet_project=''

aethernet_set_project() {
	aethernet_project=$(aethernet_compose_project)
	if [ -z "$aethernet_project" ]; then
		aethernet_fail 2 "$aethernet_compose_base in $opt_dir declares no project name, so the volume names cannot be derived."
	fi
}

# A second install reuses the volumes of the first, because the compose project
# name is fixed. Those volumes hold the old secrets, so the new .env never opens
# them and the stack starts into an authentication loop.
aethernet_check_volumes() {
	aethernet_project=$(aethernet_compose_project)
	if [ -z "$aethernet_project" ]; then
		return 0
	fi
	$aethernet_engine volume ls -q --filter "label=com.docker.compose.project=$aethernet_project" > "$aethernet_scratch/volumes" 2>/dev/null || return 0
	if [ -s "$aethernet_scratch/volumes" ]; then
		aethernet_fail 3 "Docker already holds volumes for the $aethernet_project project. They hold the secrets of an earlier install, and this .env does not open them. Run install.sh --update in the directory that holds that instance, or remove the volumes with $aethernet_engine volume rm before you install again."
	fi
}

aethernet_base64url() {
	openssl base64 -A | tr '+/' '-_' | tr -d '='
}

aethernet_vapid_public=''
aethernet_vapid_private=''

# The VAPID pair is the one secret in .env that no random draw produces.
# AETHERNET_VAPID_PUBLIC_KEY is base64url of the 65-byte uncompressed P-256 point
# and AETHERNET_VAPID_PRIVATE_KEY is base64url of its 32-byte scalar. The stack
# requires both even when nobody enables browser notifications.
#
# By hand:
#   openssl ecparam -name prime256v1 -genkey -noout -out vapid.pem
#   openssl ec -in vapid.pem -outform DER | od -An -tx1 -N7 | tr -d ' \n'
#   The line above must print 30770201010420. Any other value means a short
#   scalar, so delete vapid.pem and draw again before going on.
#   openssl ec -in vapid.pem -outform DER | tail -c +8 | head -c 32 | openssl base64 -A | tr '+/' '-_' | tr -d '='
#   openssl ec -in vapid.pem -pubout -outform DER | tail -c 65 | openssl base64 -A | tr '+/' '-_' | tr -d '='
#
# The private key is 43 characters and the public key is 87.
#
# LibreSSL trims a leading zero byte off the SEC1 private key, which shifts the
# scalar and yields a well formed value that no push service accepts. The header
# check rejects that key and the loop draws another one.
aethernet_generate_vapid() {
	aethernet_vapid_try=1
	while [ "$aethernet_vapid_try" -le "$AETHERNET_VAPID_ATTEMPTS" ]; do
		openssl ecparam -name prime256v1 -genkey -noout -out "$aethernet_scratch/vapid.pem" 2>/dev/null
		openssl ec -in "$aethernet_scratch/vapid.pem" -outform DER -out "$aethernet_scratch/vapid.der" 2>/dev/null
		openssl ec -in "$aethernet_scratch/vapid.pem" -pubout -outform DER -out "$aethernet_scratch/vapid.pub.der" 2>/dev/null
		aethernet_vapid_header=$(od -An -tx1 -N7 < "$aethernet_scratch/vapid.der" | tr -d ' \n')
		if [ "$aethernet_vapid_header" = "$AETHERNET_SEC1_HEADER" ]; then
			aethernet_vapid_private=$(tail -c +8 "$aethernet_scratch/vapid.der" | head -c 32 | aethernet_base64url)
			aethernet_vapid_public=$(tail -c 65 "$aethernet_scratch/vapid.pub.der" | aethernet_base64url)
			rm -f "$aethernet_scratch/vapid.pem" "$aethernet_scratch/vapid.der" "$aethernet_scratch/vapid.pub.der"
			if [ ${#aethernet_vapid_private} -eq 43 ] && [ ${#aethernet_vapid_public} -eq 87 ]; then
				return 0
			fi
			return 1
		fi
		aethernet_vapid_try=$((aethernet_vapid_try + 1))
	done
	return 1
}

# The same file by hand, which is what this function does in one pass:
#
#   cp .env.example .env
#   chmod 600 .env
#
# Then set AETHERNET_DOMAIN and AETHERNET_VAPID_EMAIL, the two values only the
# operator knows. The five other non-secret keys in the list above ship correct
# in .env.example and need no edit.
#
# Every secret in .env.example carries the literal CHANGE_ME. A key whose name
# ends in _BASE64 takes openssl rand -base64 32, every other key takes
# openssl rand -hex 32, and the VAPID pair comes from the generator above.
#
# Under --tls proxy, COMPOSE_FILE and AETHERNET_EDGE_BIND already sit in
# .env.example as commented lines, so by hand they are uncommented rather than
# added.
aethernet_write_env() {
	aethernet_env_tmp="$aethernet_scratch/env"
	aethernet_old_umask=$(umask)
	umask 077
	: > "$aethernet_env_tmp"
	aethernet_non_secret_keys > "$aethernet_scratch/non-secret-keys"
	while read -r aethernet_key aethernet_kind aethernet_literal; do
		[ -n "$aethernet_key" ] || continue
		case $aethernet_kind in
			domain) aethernet_value=$opt_domain ;;
			email) aethernet_value=$opt_email ;;
			image_tag) aethernet_value=$opt_image_tag ;;
			literal) aethernet_value=$aethernet_literal ;;
			*) aethernet_fail 5 "Unknown non-secret kind $aethernet_kind for $aethernet_key." ;;
		esac
		printf '%s=%s\n' "$aethernet_key" "$aethernet_value" >> "$aethernet_env_tmp"
	done < "$aethernet_scratch/non-secret-keys"
	if [ "$opt_tls" = 'proxy' ]; then
		printf 'COMPOSE_FILE=%s\n' 'docker-compose.yml:docker-compose.proxy.yml' >> "$aethernet_env_tmp"
		printf 'AETHERNET_EDGE_BIND=%s\n' "$opt_edge_bind" >> "$aethernet_env_tmp"
	fi
	aethernet_secret_keys > "$aethernet_scratch/secret-keys"
	while read -r aethernet_key aethernet_kind; do
		[ -n "$aethernet_key" ] || continue
		case $aethernet_kind in
			hex) aethernet_value=$(openssl rand -hex 32) ;;
			base64) aethernet_value=$(openssl rand -base64 32) ;;
			vapid_public) aethernet_value=$aethernet_vapid_public ;;
			vapid_private) aethernet_value=$aethernet_vapid_private ;;
			*) aethernet_fail 5 "Unknown secret kind $aethernet_kind for $aethernet_key." ;;
		esac
		if [ -z "$aethernet_value" ]; then
			aethernet_fail 5 "Generated an empty value for $aethernet_key."
		fi
		printf '%s=%s\n' "$aethernet_key" "$aethernet_value" >> "$aethernet_env_tmp"
	done < "$aethernet_scratch/secret-keys"
	mv "$aethernet_env_tmp" "$opt_dir/.env"
	chmod 600 "$opt_dir/.env"
	umask "$aethernet_old_umask"
}

aethernet_stack_ready() {
	$aethernet_engine compose ps -aq > "$aethernet_scratch/ids" 2>/dev/null || return 1
	[ -s "$aethernet_scratch/ids" ] || return 1
	xargs $aethernet_engine inspect --format "$AETHERNET_INSPECT_FORMAT" < "$aethernet_scratch/ids" > "$aethernet_scratch/state" 2>/dev/null || return 1
	aethernet_ready=1
	aethernet_init_done=0
	while read -r aethernet_service aethernet_status aethernet_health aethernet_code; do
		case $aethernet_status in
			running)
				case $aethernet_health in
					healthy|none) ;;
					*) aethernet_ready=0 ;;
				esac
				;;
			exited)
				if [ "$aethernet_service" = 'seaweedfs-init' ] && [ "$aethernet_code" = '0' ]; then
					aethernet_init_done=1
				else
					aethernet_ready=0
				fi
				;;
			*)
				aethernet_ready=0
				;;
		esac
	done < "$aethernet_scratch/state"
	[ "$aethernet_ready" -eq 1 ] && [ "$aethernet_init_done" -eq 1 ]
}

# Readiness comes from Compose state, which is local and authoritative.
#
# By hand:
#   docker compose ps
#
# Every service reads running or healthy except seaweedfs-init, which reads
# exited (0) because it is a one-shot bucket initialiser.
aethernet_wait_ready() {
	aethernet_waited=0
	while [ "$aethernet_waited" -lt "$AETHERNET_READY_TIMEOUT" ]; do
		if aethernet_stack_ready; then
			return 0
		fi
		sleep "$AETHERNET_READY_INTERVAL"
		aethernet_waited=$((aethernet_waited + AETHERNET_READY_INTERVAL))
	done
	return 1
}

aethernet_env_value() {
	sed -n "s/^$1=\\(.*\\)\$/\\1/p" "$opt_dir/.env" | head -n 1
}

# The origin browsers use. .env states it outright when AETHERNET_PUBLIC_ORIGIN is
# set, and Compose otherwise builds the same string from the scheme, the domain
# and the port, dropping a port that is the default for its scheme.
#
# Compose expands a ${...} reference inside an .env value and this script does
# not, so a AETHERNET_PUBLIC_ORIGIN written that way is skipped rather than printed
# back with the braces still in it. The three names below say the same address,
# so the derived string is the right one to fall back to.
#
# By hand:
#   grep -E '^AETHERNET_(PUBLIC_ORIGIN|PUBLIC_SCHEME|DOMAIN|PUBLIC_PORT)=' .env
aethernet_public_origin() {
	aethernet_origin=$(aethernet_env_value AETHERNET_PUBLIC_ORIGIN)
	case $aethernet_origin in
		*'${'*)
			printf '%s\n' 'AETHERNET_PUBLIC_ORIGIN in .env holds a ${...} reference. This script does not expand those, so the address below comes from AETHERNET_PUBLIC_SCHEME, AETHERNET_DOMAIN and AETHERNET_PUBLIC_PORT instead.' >&2
			aethernet_origin=''
			;;
	esac
	if [ -n "$aethernet_origin" ]; then
		printf '%s' "${aethernet_origin%/}"
		return 0
	fi
	aethernet_origin_host=$(aethernet_env_value AETHERNET_DOMAIN)
	if [ -z "$aethernet_origin_host" ]; then
		return 0
	fi
	aethernet_origin_scheme=$(aethernet_env_value AETHERNET_PUBLIC_SCHEME)
	if [ -z "$aethernet_origin_scheme" ]; then
		aethernet_origin_scheme='https'
	fi
	aethernet_origin_port=$(aethernet_env_value AETHERNET_PUBLIC_PORT)
	if [ -z "$aethernet_origin_port" ]; then
		aethernet_origin_suffix=''
	else
		case $aethernet_origin_scheme:$aethernet_origin_port in
			http:80|https:443) aethernet_origin_suffix='' ;;
			*) aethernet_origin_suffix=":$aethernet_origin_port" ;;
		esac
	fi
	printf '%s://%s%s' "$aethernet_origin_scheme" "$aethernet_origin_host" "$aethernet_origin_suffix"
}

# The public probe is informational. A host behind hairpin NAT cannot always
# reach its own hostname, and a false failure there would be worse than no probe.
# It asks the origin .env advertises, so an instance on a non-default port is
# probed where it actually answers.
aethernet_probe() {
	aethernet_probe_origin=$1
	aethernet_probe_authority=${aethernet_probe_origin#*://}
	aethernet_probe_host=${aethernet_probe_authority%%:*}
	case $aethernet_probe_origin in
		http://*) aethernet_probe_port='80' ;;
		*) aethernet_probe_port='443' ;;
	esac
	case $aethernet_probe_authority in
		*:*) aethernet_probe_port=${aethernet_probe_authority##*:} ;;
	esac
	aethernet_probe_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$aethernet_probe_origin/_health" 2>/dev/null || true)
	if [ -z "$aethernet_probe_code" ]; then
		aethernet_probe_code='000'
	fi
	if [ "$aethernet_probe_code" = '200' ]; then
		aethernet_say "$aethernet_probe_origin/_health answers 200."
		return 0
	fi
	aethernet_say "$aethernet_probe_origin/_health answers $aethernet_probe_code from this host. Check the DNS record for $aethernet_probe_host and inbound port $aethernet_probe_port."
}

# The keys a refreshed stack requires that an .env written by an older installer
# does not hold. Only keys with no state anywhere else are here. A value like
# POSTGRES_PASSWORD is matched by a password stored inside the database, so
# minting a new one locks the stack out of its own data and it is not listed.
#
# CHANGE_ME counts as absent. .env.example shipped the relay secret with that
# value for a while, and nothing read it until the API began refusing to start
# on a value under 32 bytes.
aethernet_upgrade_secret_keys() {
	cat <<'KEYS'
AETHERNET_ERLANG_COOKIE hex
AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 base64
KEYS
}

# One key written into .env, through a temporary file that replaces the whole
# file at once.
#
# Appending is not an option. A .env whose last line has no newline takes an
# appended line onto the end of that line instead, which reads as one key whose
# value ends in the name of the next, and destroys the secret that was there.
# awk ends every line it prints, so reading the file and writing it back gives
# the missing newline as a side effect.
#
# The replacement is a rename, so an interrupt leaves the old file whole rather
# than a truncated one, and this runs before the record exists.
aethernet_env_set() {
	aethernet_old_umask=$(umask)
	umask 077
	awk -v aethernet_k="$1" -v aethernet_v="$2" '
		index($0, aethernet_k "=") == 1 && !aethernet_done {print aethernet_k "=" aethernet_v; aethernet_done = 1; next}
		{print}
		END {if (!aethernet_done) print aethernet_k "=" aethernet_v}
	' "$opt_dir/.env" > "$aethernet_scratch/env.set"
	if [ ! -s "$aethernet_scratch/env.set" ]; then
		umask "$aethernet_old_umask"
		aethernet_fail 5 "Rewriting $1 into .env produced an empty file. Nothing was written."
	fi
	if ! grep -q "^$1=" "$aethernet_scratch/env.set"; then
		umask "$aethernet_old_umask"
		aethernet_fail 5 "Rewriting $1 into .env did not write that key. Nothing was written."
	fi
	mv "$aethernet_scratch/env.set" "$opt_dir/.env"
	chmod 600 "$opt_dir/.env"
	umask "$aethernet_old_umask"
}

# Step 0 of an upgrade: mint the values the refreshed stack requires.
#
# Compose stops on a ${NAME:?} it cannot resolve, so a key the running .env does
# not hold fails every command this script runs before it reaches the step that
# would have reported it. Writing the value first is what makes the rest of the
# run possible, and a generated secret is as good as a hand-written one for
# every key listed above.
#
# This runs before the record, so the .env the record saves is the one that
# works and a rollback does not reintroduce the gap.
# The keys the run would write, one per line, without writing any of them. The
# plan and the run read the same list, so a plan cannot describe a run that does
# something else.
aethernet_missing_required_secrets() {
	aethernet_upgrade_secret_keys > "$aethernet_scratch/upgrade-keys"
	while read -r aethernet_key aethernet_kind; do
		[ -n "$aethernet_key" ] || continue
		aethernet_current=$(aethernet_env_value "$aethernet_key")
		case ${aethernet_current:-} in
			''|CHANGE_ME) printf '%s\n' "$aethernet_key" ;;
		esac
	done < "$aethernet_scratch/upgrade-keys"
}

aethernet_fill_required_secrets() {
	aethernet_upgrade_secret_keys > "$aethernet_scratch/upgrade-keys"
	while read -r aethernet_key aethernet_kind; do
		[ -n "$aethernet_key" ] || continue
		aethernet_current=$(aethernet_env_value "$aethernet_key")
		case ${aethernet_current:-} in
			''|CHANGE_ME) ;;
			*) continue ;;
		esac
		case $aethernet_kind in
			hex) aethernet_new=$(openssl rand -hex 32) ;;
			base64) aethernet_new=$(openssl rand -base64 32) ;;
			*) aethernet_fail 5 "Unknown secret kind $aethernet_kind for $aethernet_key." ;;
		esac
		[ -n "$aethernet_new" ] || aethernet_fail 5 "Generated an empty value for $aethernet_key."
		aethernet_env_set "$aethernet_key" "$aethernet_new"
		aethernet_say "Wrote $aethernet_key into .env. The refreshed stack requires it and this instance held no usable value."
	done < "$aethernet_scratch/upgrade-keys"
}

aethernet_require_instance() {
	if [ ! -e "$opt_dir/.env" ]; then
		aethernet_fail 2 "No .env in $opt_dir. That directory holds no instance. Run install.sh with neither --update nor --rollback to set one up."
	fi
	aethernet_resolve_compose_base
	if [ ! -e "$opt_dir/$aethernet_compose_base" ]; then
		if [ -n "$aethernet_compose_base_from" ]; then
			aethernet_fail 2 "$aethernet_compose_base_from names $aethernet_compose_base first, and $opt_dir/$aethernet_compose_base is not there. Put that file back, or name the file the instance runs on first in COMPOSE_FILE."
		fi
		aethernet_fail 2 "No compose file in $opt_dir. Compose looks for compose.yaml, compose.yml, docker-compose.yml and docker-compose.yaml there, and that directory holds none of them, so it does not hold an instance."
	fi
	if [ ! -s "$opt_dir/$aethernet_compose_base" ]; then
		aethernet_fail 2 "$opt_dir/$aethernet_compose_base is empty. A redirect that captured a failed download leaves that, and Compose refuses an empty compose file. Put the file back from a backup or from the record of the last upgrade, then run this again."
	fi
	if [ "$aethernet_compose_base" != 'docker-compose.yml' ]; then
		aethernet_say "Compose loads $aethernet_compose_base in $opt_dir, so the stack's docker-compose.yml is written to that name."
	fi
}

# Compose reads COMPOSE_FILE from .env and loads every file it names before it
# answers anything, so one file the directory does not hold fails every docker
# compose command run in it. What Compose prints for that is a single stat line
# that names neither COMPOSE_FILE nor .env.
#
# Two of the files this script downloads sit in .env.example as a COMPOSE_FILE
# line to uncomment, so an instance set up before this script existed can hold
# the line and not the file. An upgrade reads the running images before it
# refreshes the stack files, so such an instance stops on the first step and no
# re-run gets any further.
#
# The line stays. Without the file it names the edge container binds 80 and 443
# and requests its own certificate.
#
# By hand:
#   grep COMPOSE_FILE .env
# A value as Compose reads it: no surrounding quotes, no carriage return from an
# editor that writes CRLF, no trailing blanks. Reading it any other way invents a
# filename the operator cannot see and refuses a run that would have worked.
aethernet_env_scalar() {
	aethernet_scalar=$(aethernet_env_value "$1" | tr -d '\r')
	aethernet_scalar=${aethernet_scalar%"${aethernet_scalar##*[! 	]}"}
	case $aethernet_scalar in
		\"*\") aethernet_scalar=${aethernet_scalar#\"}; aethernet_scalar=${aethernet_scalar%\"} ;;
		"'"*"'") aethernet_scalar=${aethernet_scalar#"'"}; aethernet_scalar=${aethernet_scalar%"'"} ;;
	esac
	printf '%s' "$aethernet_scalar"
}

aethernet_read_compose_setting() {
	aethernet_compose_file=${COMPOSE_FILE:-}
	aethernet_compose_from="the environment"
	if [ -z "$aethernet_compose_file" ]; then
		aethernet_compose_file=$(aethernet_env_scalar COMPOSE_FILE)
		aethernet_compose_from="$opt_dir/.env"
	fi
	aethernet_path_sep=${COMPOSE_PATH_SEPARATOR:-}
	if [ -z "$aethernet_path_sep" ]; then
		aethernet_path_sep=$(aethernet_env_scalar COMPOSE_PATH_SEPARATOR)
	fi
	if [ -z "$aethernet_path_sep" ]; then
		aethernet_path_sep=':'
	fi
}

aethernet_resolve_compose_base() {
	aethernet_read_compose_setting
	aethernet_compose_base_from=''
	aethernet_rest=$aethernet_compose_file
	while [ -n "$aethernet_rest" ]; do
		aethernet_name=${aethernet_rest%%"$aethernet_path_sep"*}
		case $aethernet_rest in
			*"$aethernet_path_sep"*) aethernet_rest=${aethernet_rest#*"$aethernet_path_sep"} ;;
			*) aethernet_rest='' ;;
		esac
		[ -n "$aethernet_name" ] || continue
		aethernet_compose_base=${aethernet_name#./}
		aethernet_compose_base=${aethernet_compose_base#"$opt_dir"/}
		aethernet_compose_base_from="COMPOSE_FILE from $aethernet_compose_from"
		break
	done
	if [ -z "$aethernet_compose_base_from" ]; then
		aethernet_compose_base=$(aethernet_compose_name_in "$opt_dir" || printf '%s' 'docker-compose.yml')
		return 0
	fi
	case $aethernet_compose_base in
		*/*) aethernet_fail 2 "$aethernet_compose_base_from names $aethernet_name first, and that file is not directly in $opt_dir. This script refreshes only the files in the directory it acts on, so the upgrade would leave the file Compose loads on the old stack. Move it into $opt_dir and name it there, or upgrade by hand." ;;
	esac
}

aethernet_require_compose_files() {
	aethernet_read_compose_setting
	[ -n "$aethernet_compose_file" ] || return 0
	aethernet_compose_count=0
	aethernet_rest=$aethernet_compose_file
	while [ -n "$aethernet_rest" ]; do
		case $aethernet_rest in
			*"$aethernet_path_sep"*)
				aethernet_name=${aethernet_rest%%"$aethernet_path_sep"*}
				aethernet_rest=${aethernet_rest#*"$aethernet_path_sep"}
				;;
			*)
				aethernet_name=$aethernet_rest
				aethernet_rest=''
				;;
		esac
		[ -n "$aethernet_name" ] || continue
		case $aethernet_name in
			/*) aethernet_path=$aethernet_name ;;
			*) aethernet_path="$opt_dir/$aethernet_name" ;;
		esac
		aethernet_compose_count=$((${aethernet_compose_count:-0} + 1))
		[ ! -e "$aethernet_path" ] || continue
		if aethernet_stack_files | grep -qxF "$aethernet_name"; then
			aethernet_fail 2 "COMPOSE_FILE from $aethernet_compose_from names $aethernet_name and $aethernet_path is not there, so every $aethernet_engine compose command in $opt_dir fails and this run stops before it changes anything. This script downloads $aethernet_name, and an instance set up before it existed does not hold that file yet. Put it in place and run this again:
  curl -fsSL --proto '=https' --tlsv1.2 -o $aethernet_path $AETHERNET_RAW_BASE/$opt_ref/$AETHERNET_STACK_PATH/$aethernet_name
Leave the COMPOSE_FILE line as it is. Without $aethernet_name the edge container binds 80 and 443 and requests its own certificate."
		fi
		aethernet_fail 2 "COMPOSE_FILE from $aethernet_compose_from names $aethernet_name and $aethernet_path is not there, so every $aethernet_engine compose command in $opt_dir fails. This script does not download $aethernet_name. Put that file back, or take it out of the COMPOSE_FILE line."
	done
	if [ "$aethernet_compose_count" -gt 1 ] &&
		! aethernet_version_ge "$aethernet_compose_version" "$AETHERNET_MIN_COMPOSE_OVERLAY"; then
		aethernet_fail 2 "COMPOSE_FILE from $aethernet_compose_from loads $aethernet_compose_count files and this host runs Compose $aethernet_compose_version. Every overlay this script downloads uses the !override tag, which needs Compose $AETHERNET_MIN_COMPOSE_OVERLAY or newer. Upgrade Compose, or load only $aethernet_compose_base."
	fi
}

# One read-only Compose query, with what Compose printed on stderr kept.
#
# Compose loads the whole file set and interpolates every variable in it before
# it answers either query below. A file that is not there, a file it cannot
# read and a required variable .env does not set all fail at that point, and the
# stderr text is the only thing that says which of them it was.
#
# The query writes to files rather than through a pipe, because the status of a
# pipeline is the status of its last command and the query is not the last
# command.
aethernet_compose_query() {
	aethernet_query_status=0
	$aethernet_engine compose config "$1" > "$aethernet_scratch/compose-out" 2> "$aethernet_scratch/compose-err" || aethernet_query_status=$?
	return "$aethernet_query_status"
}

# What Compose printed on the last query, indented one level for the caller.
aethernet_compose_error() {
	if [ -s "$aethernet_scratch/compose-err" ]; then
		sed "s/^/$1/" "$aethernet_scratch/compose-err"
	else
		printf '%snothing\n' "$1"
	fi
}

# The image references the stack resolves to, one per line, deduplicated. Compose
# expands them from docker-compose.yml and .env, so this is the same resolution
# docker compose pull performs. It names the images, not the versions of them.
#
# By hand:
#   docker compose config --images
aethernet_compose_images() {
	aethernet_compose_query --images || return 1
	sort -u "$aethernet_scratch/compose-out"
}

# The image ID each container was actually created from, against the reference
# Compose created it under.
#
# docker image inspect <reference> answers a different question: what that tag
# points at on this host now. The two disagree whenever a newer image already
# sits under a moving tag, which is the state an upgrade that pulled and then
# failed leaves behind, and that is the state the operator re-runs --update from.
# Reading the tag there records the image the stack is about to move to as the
# image it is moving from, and the rollback that follows puts back what is
# already running while reporting success.
#
# By hand:
#   docker compose ps -aq | xargs docker inspect --format '{{.Config.Image}} {{.Image}}'
# The text of a captured stream, indented one level for the caller, or a word
# saying there was none. A command that fails without printing is rarer than one
# that prints the reason, and both read the same way here.
aethernet_indent_file() {
	if [ -s "$1" ]; then
		sed "s/^/$2/" "$1"
	else
		printf '%snothing\n' "$2"
	fi
}

aethernet_running_image_ids() {
	if ! $aethernet_engine compose ps -aq > "$aethernet_scratch/containers" 2> "$aethernet_scratch/ps-err"; then
		aethernet_fail 2 "$aethernet_engine compose ps failed in $opt_dir, so what is running cannot be read and the record would name no image ID at all. Compose printed:
$(aethernet_indent_file "$aethernet_scratch/ps-err" '  ')"
	fi
	[ -s "$aethernet_scratch/containers" ] || return 0
	if ! xargs $aethernet_engine inspect --format '{{.Config.Image}} {{.Image}}' \
		< "$aethernet_scratch/containers" > "$aethernet_scratch/inspected" 2> "$aethernet_scratch/inspect-err"; then
		aethernet_fail 2 "$aethernet_engine inspect failed in $opt_dir, so the image ID under each reference cannot be read and a rollback would have nothing to go back to. Docker printed:
$(aethernet_indent_file "$aethernet_scratch/inspect-err" '  ')"
	fi
	sort -u "$aethernet_scratch/inspected"
}

# The recorded ID for one reference, or nothing when no container carries it.
aethernet_recorded_id_for() {
	awk -v aethernet_want="$1" '$1 == aethernet_want {print $2; exit}' "$aethernet_scratch/running"
}

# Step 1 of an upgrade: record what is running before anything moves.
#
# AETHERNET_IMAGE_TAG defaults to v1, which tracks the latest compatible release.
# The tag therefore reads v1 before and after the upgrade, and the image ID is
# the only thing that tells two releases apart. That is what makes this record
# the version history the stack does not otherwise keep, and what makes a
# rollback possible on a moving tag.
#
# The reference list comes from Compose and the ID under each reference comes
# from the container running it, for the reason in aethernet_running_image_ids. A
# reference no container carries is recorded as `-`, which a rollback skips,
# because a version that was not running is not a version to go back to.
#
# By hand:
#   docker compose images
aethernet_record_state() {
	aethernet_running_image_ids > "$aethernet_scratch/running"
	if ! aethernet_compose_images > "$aethernet_scratch/refs"; then
		aethernet_fail 2 "$aethernet_engine compose config --images failed in $opt_dir, so the running version cannot be recorded. Compose printed:
$(aethernet_compose_error '  ')"
	fi
	if [ ! -s "$aethernet_scratch/refs" ]; then
		aethernet_fail 2 "$aethernet_engine compose config --images returned nothing in $opt_dir, so the running version cannot be recorded. The stack files there declare no service with an image."
	fi
	aethernet_prepare_record
	printf '%s\n' "$(aethernet_env_value AETHERNET_IMAGE_TAG)" > "$aethernet_record/$AETHERNET_TAG_FILE"
	: > "$aethernet_record/$AETHERNET_IMAGES_FILE"
	while read -r aethernet_ref; do
		[ -n "$aethernet_ref" ] || continue
		aethernet_id=$(aethernet_recorded_id_for "$aethernet_ref")
		if [ -z "$aethernet_id" ]; then
			aethernet_id='-'
		fi
		printf '%s %s\n' "$aethernet_ref" "$aethernet_id" >> "$aethernet_record/$AETHERNET_IMAGES_FILE"
	done < "$aethernet_scratch/refs"
	aethernet_say "Recorded $(wc -l < "$aethernet_record/$AETHERNET_IMAGES_FILE" | tr -d ' ') image references in $aethernet_record."
}

# .env and the stack files go into the record because nothing else regenerates
# them. .env holds every secret the instance was built with, so the record
# directory is created 700 and the copy is 600, and the record belongs wherever
# the operator already keeps secrets.
aethernet_save_current_files() {
	cp -p "$opt_dir/.env" "$aethernet_record/.env"
	chmod 600 "$aethernet_record/.env"
	while read -r aethernet_file; do
		[ -n "$aethernet_file" ] || continue
		aethernet_placed="$opt_dir/$(aethernet_placed_name "$aethernet_file")"
		if [ -s "$aethernet_placed" ]; then
			cp -p "$aethernet_placed" "$aethernet_record/$aethernet_file"
		elif [ -e "$aethernet_placed" ]; then
			aethernet_fail 7 "$aethernet_placed is empty, so the record would hold a file a rollback could not use. Put the file back before upgrading."
		fi
	done < "$aethernet_scratch/files"
}

aethernet_postgres_running() {
	aethernet_pg_id=$($aethernet_engine compose ps -q postgres 2>/dev/null | head -n 1)
	[ -n "$aethernet_pg_id" ] || return 1
	[ "$($aethernet_engine inspect --format '{{.State.Status}}' "$aethernet_pg_id" 2>/dev/null)" = 'running' ]
}

# Step 2 of an upgrade, and the part that gates the rest.
#
# api, worker, users-shard and messages-shard apply schema changes while they
# start, and starting an older image does not undo them. The dump taken before
# the pull is the only way back across a schema change.
#
# By hand:
#   docker compose exec -T postgres pg_dump -U aethernet -d aethernet --format=custom > backups/aethernet.dump
#
# The database and the role are both named aethernet and are fixed in
# docker-compose.yml. Keep -T. Without it Docker attaches a terminal to the
# command and the dump arrives corrupted, which is why the first five bytes are
# checked against the custom-format magic below rather than only the size.
#
# The dump runs against the live stack. pg_dump reads inside one transaction, so
# it sees a consistent database without stopping anything. The volume copy below
# has no equivalent and is why the stack stops there and not here.
#
# The volume copy measures its volume and refuses when the disk is short. This
# step does not, because the size of a custom-format dump is not knowable before
# pg_dump writes it. Point --backup-dir at a filesystem with room for the
# database.
# The bundled data stores are services in the stack file. An operator who points
# the stack at a database or an object store outside it takes those services out,
# and the two backup steps that reach into them then have nothing to reach. That
# is a supported shape rather than a fault, so each step says what it skipped and
# the upgrade goes on. Backing up a store outside the stack belongs to whoever
# runs it.
aethernet_stack_defines_service() {
	if [ ! -f "$aethernet_scratch/all-services" ]; then
		if ! aethernet_compose_services > "$aethernet_scratch/all-services"; then
			rm -f "$aethernet_scratch/all-services"
			aethernet_fail 6 "docker compose config --services failed in $opt_dir, so the services this stack defines cannot be read. Compose printed:
$(aethernet_compose_error '  ')"
		fi
	fi
	grep -qxF "$1" "$aethernet_scratch/all-services"
}

aethernet_dump_postgres() {
	if ! aethernet_stack_defines_service postgres; then
		aethernet_say 'Skipping the database dump. This stack defines no postgres service, so its database runs outside the stack and only the operator of that database can dump it.'
		return 0
	fi
	if ! aethernet_postgres_running; then
		aethernet_say 'Postgres is not running. Starting it for the dump.'
		if ! $aethernet_engine compose up -d --wait postgres; then
			aethernet_fail 7 "Postgres does not start in $opt_dir, so no dump can be taken."
		fi
	fi
	aethernet_dump_path="$aethernet_record/$AETHERNET_DUMP_FILE"
	aethernet_say 'Dumping the database.'
	if ! $aethernet_engine compose exec -T postgres pg_dump -U aethernet -d aethernet --format=custom > "$aethernet_dump_path"; then
		rm -f "$aethernet_dump_path"
		aethernet_fail 7 'pg_dump failed. The instance is untouched.'
	fi
	if [ "$(head -c 5 "$aethernet_dump_path")" != 'PGDMP' ]; then
		rm -f "$aethernet_dump_path"
		aethernet_fail 7 'The dump does not begin with the custom-format header. The instance is untouched.'
	fi
	aethernet_say "Dumped the database to $aethernet_dump_path."
}

# What the sizing container printed, indented one level for the caller.
aethernet_volume_error() {
	if [ -s "$aethernet_scratch/volume-err" ]; then
		sed "s/^/$1/" "$aethernet_scratch/volume-err"
	else
		printf '%snothing\n' "$1"
	fi
}

aethernet_volume_size_kb() {
	$aethernet_engine run --rm -v "$1:/data:ro" "$AETHERNET_HELPER_IMAGE" du -sk /data 2> "$aethernet_scratch/volume-err" |
		awk 'NR==1 {print $1}'
}

aethernet_free_kb() {
	df -Pk "$1" 2>/dev/null | awk 'NR==2 {print $4}'
}

# Step 2 continued: the volume copy.
#
# A live copy can catch a file mid-write, so the stack stops for it. The stack
# comes back up on the images it was already running before anything else
# happens, so a failure here leaves a working instance rather than a stopped one.
#
# By hand:
#   docker compose stop
#   docker run --rm -v aethernet_seaweedfs-data:/data -v "$PWD/backups:/backup" alpine tar czf /backup/seaweedfs-data.tgz -C /data .
#   docker compose up -d
aethernet_copy_volumes() {
	if ! aethernet_stack_defines_service seaweedfs; then
		aethernet_say 'Skipping the uploads copy. This stack defines no seaweedfs service, so its objects live outside the stack and only the operator of that store can copy them.'
		return 0
	fi
	aethernet_backup_volumes > "$aethernet_scratch/backup-volumes"
	: > "$aethernet_scratch/copy-volumes"
	aethernet_copy_any=0
	while read -r aethernet_volume; do
		[ -n "$aethernet_volume" ] || continue
		aethernet_full="${aethernet_project}_${aethernet_volume}"
		if ! $aethernet_engine volume inspect "$aethernet_full" >/dev/null 2>&1; then
			aethernet_fail 7 "The volume $aethernet_full does not exist, so the uploads cannot be copied. The stack declares that volume, so this is a project name other than $aethernet_project or a volume that was removed. Pass --no-volume-backup to take the database dump alone when the uploads of this instance live somewhere this script cannot reach."
		fi
		aethernet_size=$(aethernet_volume_size_kb "$aethernet_full")
		case ${aethernet_size:-} in
			''|*[!0-9]*)
				aethernet_fail 7 "Cannot measure the volume $aethernet_full, so the uploads copy cannot be sized. Pass --no-volume-backup to take the database dump alone. Docker printed:
$(aethernet_volume_error '  ')" ;;
		esac
		aethernet_free=$(aethernet_free_kb "$aethernet_record")
		case ${aethernet_free:-} in
			''|*[!0-9]*) aethernet_fail 7 "Cannot read the free space on $aethernet_record." ;;
		esac
		aethernet_need=$((aethernet_size * AETHERNET_VOLUME_HEADROOM / 100))
		if [ "$aethernet_free" -lt "$aethernet_need" ]; then
			aethernet_fail 7 "$aethernet_full holds $((aethernet_size / 1024)) MB and $aethernet_record has $((aethernet_free / 1024)) MB free. Point --backup-dir at a filesystem with room, or pass --no-volume-backup to take the database dump alone."
		fi
		printf '%s\n' "$aethernet_volume" >> "$aethernet_scratch/copy-volumes"
		aethernet_copy_any=1
	done < "$aethernet_scratch/backup-volumes"
	if [ "$aethernet_copy_any" -eq 0 ]; then
		return 0
	fi
	aethernet_say 'Stopping the stack for a consistent copy of the uploads.'
	if ! $aethernet_engine compose stop; then
		aethernet_fail 7 "$aethernet_engine compose stop failed in $opt_dir."
	fi
	while read -r aethernet_volume; do
		[ -n "$aethernet_volume" ] || continue
		aethernet_full="${aethernet_project}_${aethernet_volume}"
		aethernet_say "Copying $aethernet_full."
		if ! $aethernet_engine run --rm -v "$aethernet_full:/data:ro" -v "$aethernet_record:/backup" "$AETHERNET_HELPER_IMAGE" tar czf "/backup/$aethernet_volume.tgz" -C /data .; then
			$aethernet_engine compose up -d --remove-orphans || true
			aethernet_fail 7 "Copying $aethernet_full failed. The stack is started again on the images it was running."
		fi
	done < "$aethernet_scratch/copy-volumes"
	aethernet_say 'Starting the stack again before the upgrade continues.'
	if ! $aethernet_engine compose up -d --remove-orphans; then
		aethernet_fail 7 "$aethernet_engine compose up -d failed in $opt_dir after the copy. Read $aethernet_engine compose logs there."
	fi
}

aethernet_backup() {
	if [ "$opt_skip_backup" -eq 1 ]; then
		aethernet_say 'Skipping the backup. --skip-backup-accept-data-loss was given, so a schema change has no way back.'
		return 0
	fi
	aethernet_dump_postgres
	if [ "$opt_no_volume_backup" -eq 1 ]; then
		aethernet_say 'Skipping the uploads copy. --no-volume-backup was given.'
		return 0
	fi
	aethernet_copy_volumes
}

aethernet_postgres_major() {
	sed -n 's/^[[:space:]]*image:[[:space:]]*postgres:\([0-9][0-9]*\).*/\1/p' "$1" | head -n 1
}

# A newer Postgres major does not read the data directory an older major wrote,
# so moving between majors means dumping, removing the volume that holds the
# database, and restoring into an empty directory. Removing that volume is the
# one destructive act in the whole procedure, and it is not something a script
# should do on an operator's behalf while they read scrolling output.
#
# The refreshed file is still in the scratch directory when this runs, so a
# refusal here leaves the instance exactly as it was.
aethernet_guard_postgres_major() {
	aethernet_old_major=$(aethernet_postgres_major "$opt_dir/$aethernet_compose_base")
	aethernet_new_major=$(aethernet_postgres_major "$aethernet_scratch/docker-compose.yml.part")
	if [ -z "$aethernet_old_major" ] || [ -z "$aethernet_new_major" ]; then
		return 0
	fi
	if [ "$aethernet_old_major" = "$aethernet_new_major" ]; then
		return 0
	fi
	aethernet_fail 3 "The refreshed docker-compose.yml pins postgres:$aethernet_new_major and this instance runs postgres:$aethernet_old_major. A major version change goes through a dump, an empty data directory and a restore, which this script does not do because it destroys the volume holding the database. Nothing was changed. The procedure is at https://aethernet.dev/operator/upgrading/"
}

# Which mounted files the refresh changes, and therefore which services need a
# restart rather than a recreate. The comparison happens while the new copies are
# still in the scratch directory, because once they are in place the old bytes
# are gone.
aethernet_note_mounted_changes() {
	: > "$aethernet_scratch/restart"
	aethernet_mounted_files > "$aethernet_scratch/mounts"
	while read -r aethernet_file aethernet_service; do
		[ -n "$aethernet_file" ] || continue
		if [ ! -e "$opt_dir/$aethernet_file" ]; then
			continue
		fi
		if ! cmp -s "$opt_dir/$aethernet_file" "$aethernet_scratch/$aethernet_file.part"; then
			printf '%s %s\n' "$aethernet_file" "$aethernet_service" >> "$aethernet_scratch/restart"
		fi
	done < "$aethernet_scratch/mounts"
}

# The service names the docker-compose.yml in place defines, one per line.
#
# A rollback puts back the stack files the record holds, and a record taken
# before a service was renamed names the old service. Restarting a service the
# file in place does not define fails, so the name is checked first.
#
# By hand:
#   docker compose config --services
aethernet_compose_services() {
	aethernet_compose_query --services || return 1
	sort -u "$aethernet_scratch/compose-out"
}

aethernet_restart_mounted() {
	[ -s "$aethernet_scratch/restart" ] || return 0
	if ! aethernet_compose_services > "$aethernet_scratch/services"; then
		aethernet_fail 6 "$aethernet_engine compose config --services failed in $opt_dir, so the services that mount a refreshed file cannot be restarted. Compose printed:
$(aethernet_compose_error '  ')"
	fi
	while read -r aethernet_file aethernet_service; do
		[ -n "$aethernet_service" ] || continue
		if ! grep -qxF "$aethernet_service" "$aethernet_scratch/services"; then
			aethernet_say "Skipping the restart of $aethernet_service, because the $aethernet_compose_base in $opt_dir defines no service by that name."
			continue
		fi
		aethernet_say "Restarting $aethernet_service, because $aethernet_file is mounted into it and up -d does not reload a mounted file."
		if ! $aethernet_engine compose restart "$aethernet_service"; then
			aethernet_fail 6 "$aethernet_engine compose restart $aethernet_service failed in $opt_dir."
		fi
	done < "$aethernet_scratch/restart"
}

# A record is created before the upgrade touches anything, so a run that refuses
# or fails after this point still leaves one behind. Such a record describes the
# state the instance is already in, which makes a rollback to it a no-op rather
# than a mistake. Only the newest record is ever used.
aethernet_prepare_record() {
	mkdir -p "$opt_backup_dir"
	chmod 700 "$opt_backup_dir"
	aethernet_record="$opt_backup_dir/$AETHERNET_RECORD_PREFIX$(date -u +%Y%m%dT%H%M%SZ)"
	if [ -e "$aethernet_record" ]; then
		aethernet_fail 3 "$aethernet_record exists already."
	fi
	mkdir -m 700 "$aethernet_record"
}

# Record names carry a UTC stamp, so the shell expands the glob in byte order
# and the last match is the most recent upgrade.
aethernet_newest_record() {
	aethernet_newest=''
	for aethernet_candidate in "$opt_backup_dir/$AETHERNET_RECORD_PREFIX"*; do
		[ -d "$aethernet_candidate" ] || continue
		aethernet_newest=${aethernet_candidate##*/}
	done
	printf '%s' "$aethernet_newest"
}

aethernet_verify_stack() {
	aethernet_say 'Waiting for every service to report ready.'
	if ! aethernet_wait_ready; then
		aethernet_fail 6 "The stack is not ready after $AETHERNET_READY_TIMEOUT seconds. Read $aethernet_engine compose logs in $opt_dir."
	fi
	aethernet_origin_value=$(aethernet_public_origin)
	if [ -n "$aethernet_origin_value" ]; then
		aethernet_probe "$aethernet_origin_value"
	fi
}

# A plan writes nothing itself. The run it describes writes .env before it reads
# anything when a required key is absent, and saying otherwise would describe a
# different run.
aethernet_plan_footer() {
	if [ -s "$aethernet_scratch/plan-secrets" ]; then
		aethernet_say 'This plan wrote nothing. The run it describes writes the keys above into .env before anything else.'
	else
		aethernet_say 'Nothing outside a temporary directory was written.'
	fi
}

aethernet_plan_update() {
	aethernet_say 'Plan: upgrade'
	aethernet_say "  directory     $opt_dir"
	aethernet_say "  ref           $opt_ref"
	aethernet_say "  image tag     $(aethernet_env_value AETHERNET_IMAGE_TAG) from .env"
	aethernet_say "  backup dir    $opt_backup_dir"
	aethernet_missing_required_secrets > "$aethernet_scratch/plan-secrets"
	if [ -s "$aethernet_scratch/plan-secrets" ]; then
		aethernet_say '  writes .env   the run mints these before it reads anything, because the refreshed stack requires them'
		while read -r aethernet_key; do
			[ -n "$aethernet_key" ] || continue
			aethernet_say "                $aethernet_key"
		done < "$aethernet_scratch/plan-secrets"
	fi
	aethernet_running_image_ids > "$aethernet_scratch/running"
	if ! aethernet_compose_images > "$aethernet_scratch/refs"; then
		aethernet_say '  refusal       $aethernet_engine compose config --images fails here, and step 1 of the upgrade reads that list'
		aethernet_say '  compose said'
		aethernet_compose_error '    '
		if [ -s "$aethernet_scratch/plan-secrets" ]; then
			aethernet_say '  outcome       the run writes the keys above first, which may be what Compose is missing, so this refusal may not stand'
		else
			aethernet_say '  outcome       the run stops on step 1 and changes nothing'
		fi
		aethernet_plan_footer
		return 0
	fi
	aethernet_say '  running now'
	while read -r aethernet_ref; do
		[ -n "$aethernet_ref" ] || continue
		aethernet_id=$(aethernet_recorded_id_for "$aethernet_ref")
		if [ -z "$aethernet_id" ]; then
			aethernet_id='no container runs this image'
		fi
		aethernet_say "    $aethernet_ref $aethernet_id"
	done < "$aethernet_scratch/refs"
	if [ "$opt_skip_backup" -eq 1 ]; then
		aethernet_say '  backup        none, and a schema change would have no way back'
	elif [ "$opt_no_volume_backup" -eq 1 ]; then
		aethernet_say '  backup        the database dump, .env, and the stack files'
	else
		aethernet_say '  backup        the database dump, the uploads volume, .env, and the stack files'
		aethernet_say '  downtime      the stack stops for the uploads copy, then again for the recreate'
	fi
	aethernet_fetch_stack
	aethernet_say '  file changes'
	aethernet_changed=0
	while read -r aethernet_file; do
		[ -n "$aethernet_file" ] || continue
		aethernet_placed=$(aethernet_placed_name "$aethernet_file")
		if [ ! -e "$opt_dir/$aethernet_placed" ]; then
			aethernet_say "    $aethernet_placed is new"
			aethernet_changed=1
		elif cmp -s "$opt_dir/$aethernet_placed" "$aethernet_scratch/$aethernet_file.part"; then
			aethernet_say "    $aethernet_placed is unchanged"
		else
			aethernet_say "    $aethernet_placed changes"
			aethernet_changed=1
		fi
	done < "$aethernet_scratch/files"
	if [ "$aethernet_changed" -eq 0 ]; then
		aethernet_say "  note          ref $opt_ref moves no stack file"
	fi
	aethernet_old_major=$(aethernet_postgres_major "$opt_dir/$aethernet_compose_base")
	aethernet_new_major=$(aethernet_postgres_major "$aethernet_scratch/docker-compose.yml.part")
	if [ -n "$aethernet_old_major" ] && [ -n "$aethernet_new_major" ] && [ "$aethernet_old_major" != "$aethernet_new_major" ]; then
		aethernet_say "  refusal       postgres moves from $aethernet_old_major to $aethernet_new_major, which this script does not do"
		aethernet_say '  outcome       the run stops at that refusal and changes nothing'
		aethernet_plan_footer
		return 0
	fi
	aethernet_note_mounted_changes
	if [ -s "$aethernet_scratch/restart" ]; then
		while read -r aethernet_file aethernet_service; do
			[ -n "$aethernet_service" ] || continue
			aethernet_say "  restart       $aethernet_service, because $aethernet_file changes and a mounted file survives up -d"
		done < "$aethernet_scratch/restart"
	fi
	aethernet_say '  commands      $aethernet_engine compose pull, $aethernet_engine compose up -d'
	aethernet_plan_footer
	aethernet_say 'Drop --dry-run to run this.'
}

aethernet_plan_rollback() {
	aethernet_rollback_name=$(aethernet_newest_record)
	if [ -z "$aethernet_rollback_name" ]; then
		aethernet_fail 2 "No record in $opt_backup_dir. A rollback needs an upgrade that recorded what was running."
	fi
	aethernet_rollback_dir="$opt_backup_dir/$aethernet_rollback_name"
	aethernet_recorded_tag=$(head -n 1 "$aethernet_rollback_dir/$AETHERNET_TAG_FILE" 2>/dev/null || true)
	aethernet_current_tag=$(aethernet_env_value AETHERNET_IMAGE_TAG)
	aethernet_say 'Plan: rollback'
	aethernet_say "  directory     $opt_dir"
	aethernet_say "  record        $aethernet_rollback_dir"
	if [ "$aethernet_recorded_tag" = "$aethernet_current_tag" ]; then
		aethernet_say "  image tag     stays $aethernet_current_tag, so the recorded image IDs move back onto it"
	else
		aethernet_say "  image tag     $aethernet_current_tag becomes $aethernet_recorded_tag in .env"
	fi
	aethernet_say '  images'
	while read -r aethernet_ref aethernet_id; do
		[ -n "$aethernet_ref" ] || continue
		if [ "$aethernet_id" = '-' ]; then
			aethernet_say "    $aethernet_ref was not recorded with an ID"
		elif $aethernet_engine image inspect --format '{{.Id}}' "$aethernet_id" >/dev/null 2>&1; then
			aethernet_say "    $aethernet_ref back to $aethernet_id"
		else
			aethernet_say "    $aethernet_ref is gone from this host, so $aethernet_id cannot come back"
		fi
	done < "$aethernet_rollback_dir/$AETHERNET_IMAGES_FILE"
	aethernet_say "  files         restored from $aethernet_rollback_dir"
	aethernet_say '  database      stays where the new release left it'
	aethernet_say 'Nothing is written. Drop --dry-run to run this.'
}

# The full upgrade, in the order that leaves a working instance behind at every
# point it can fail.
aethernet_run_update() {
	aethernet_open_scratch "$opt_dir"
	aethernet_stack_files > "$aethernet_scratch/files"
	aethernet_fill_required_secrets
	aethernet_record_state
	aethernet_save_current_files
	aethernet_backup
	aethernet_fetch_stack
	aethernet_guard_postgres_major
	aethernet_note_mounted_changes
	aethernet_place_stack
	# The pull runs while the old containers still serve, so the long part of an
	# upgrade costs no downtime.
	#
	# By hand:
	#   docker compose pull
	aethernet_say 'Pulling images.'
	if ! $aethernet_engine compose pull; then
		aethernet_fail 4 "$aethernet_engine compose pull failed in $opt_dir. The stack files are refreshed and the instance still runs the old images."
	fi
	# Recreates the containers whose image or configuration changed and leaves
	# the rest running.
	#
	# By hand:
	#   docker compose up -d --remove-orphans
	#
	# Behind your own reverse proxy every command names the overlay, which
	# COMPOSE_FILE in .env does once. An invocation without it recreates the edge
	# from the base file, which binds 80 and 443 and requests its own
	# certificate.
	#
	# api, worker, users-shard and messages-shard each apply the database schema
	# while they start, so the upgrade is not finished until all four are back
	# up. All four take the same Postgres advisory lock around that work, so
	# several of them starting at once is safe.
	#
	# app-proxy waits for api to report healthy and the edge waits for the
	# Gateway, so the hostname returns errors for a minute or two after this
	# call. The api healthcheck allows 90 seconds before it counts a failure.
	aethernet_say 'Recreating the stack.'
	if ! $aethernet_engine compose up -d --remove-orphans; then
		aethernet_fail 6 "$aethernet_engine compose up -d failed in $opt_dir. Read $aethernet_engine compose logs there."
	fi
	aethernet_restart_mounted
	aethernet_verify_stack
	aethernet_say "Instance upgraded in $opt_dir."
	aethernet_say "The record of what it ran before is in $aethernet_record."
	aethernet_say "Go back with sh install.sh --rollback --dir $opt_dir."
	exit 0
}

# Puts one line of .env back, and proves it touched nothing else.
#
# AETHERNET_IMAGE_TAG is the only key this function writes. Every other line,
# which is every secret, is compared byte for byte before the new file replaces
# the old one, so a rewrite that lost or changed a secret cannot land.
aethernet_set_image_tag() {
	if ! grep -q '^AETHERNET_IMAGE_TAG=' "$opt_dir/.env"; then
		aethernet_fail 3 "$opt_dir/.env declares no AETHERNET_IMAGE_TAG, so the tag cannot be put back. Set it by hand."
	fi
	aethernet_old_umask=$(umask)
	umask 077
	sed "s|^AETHERNET_IMAGE_TAG=.*|AETHERNET_IMAGE_TAG=$1|" "$opt_dir/.env" > "$aethernet_scratch/env.new"
	grep -v '^AETHERNET_IMAGE_TAG=' "$opt_dir/.env" > "$aethernet_scratch/env.before" || true
	grep -v '^AETHERNET_IMAGE_TAG=' "$aethernet_scratch/env.new" > "$aethernet_scratch/env.after" || true
	if [ ! -s "$aethernet_scratch/env.before" ] || ! cmp -s "$aethernet_scratch/env.before" "$aethernet_scratch/env.after"; then
		umask "$aethernet_old_umask"
		aethernet_fail 3 'Rewriting AETHERNET_IMAGE_TAG would have changed another line in .env. Nothing was written.'
	fi
	mv "$aethernet_scratch/env.new" "$opt_dir/.env"
	chmod 600 "$opt_dir/.env"
	umask "$aethernet_old_umask"
	aethernet_say "AETHERNET_IMAGE_TAG in .env is $1."
}

# A rollback moves the images and the stack files back. The database stays where
# the new release left it, because api, worker, users-shard and messages-shard
# apply schema work in place while they start and an older image does not undo
# it. Across a release that changed the schema, the dump in the record is the
# only way back, and putting it back is a separate decision an operator makes.
#
# Two shapes, depending on what the upgrade moved:
#
#   A pinned tag moved, so the old images still carry their own tag. The tag goes
#   back into .env and Compose finds them.
#
#     By hand: set AETHERNET_IMAGE_TAG back, then docker compose up -d
#
#   A moving tag such as v1 stayed put and the images under it changed. The
#   recorded image IDs are still on the host until a prune removes them, so the
#   old ID goes back onto the tag it had.
#
#     By hand: docker image tag <recorded id> ghcr.io/aethernetapp/aethernet-api:v1
#
# Neither shape pulls. A pull is what moved the instance forward in the first
# place, and running one here would undo the rollback in the same breath.
aethernet_run_rollback() {
	aethernet_rollback_name=$(aethernet_newest_record)
	if [ -z "$aethernet_rollback_name" ]; then
		aethernet_fail 2 "No record in $opt_backup_dir. A rollback needs an upgrade that recorded what was running."
	fi
	aethernet_rollback_dir="$opt_backup_dir/$aethernet_rollback_name"
	if [ ! -s "$aethernet_rollback_dir/$AETHERNET_IMAGES_FILE" ]; then
		aethernet_fail 2 "$aethernet_rollback_dir records no images."
	fi
	aethernet_open_scratch "$opt_dir"
	aethernet_stack_files > "$aethernet_scratch/files"
	aethernet_say "Rolling back to $aethernet_rollback_dir."

	aethernet_recorded_tag=$(head -n 1 "$aethernet_rollback_dir/$AETHERNET_TAG_FILE" 2>/dev/null || true)
	aethernet_current_tag=$(aethernet_env_value AETHERNET_IMAGE_TAG)
	aethernet_moved=0
	if [ -n "$aethernet_recorded_tag" ] && [ "$aethernet_recorded_tag" != "$aethernet_current_tag" ]; then
		case $aethernet_recorded_tag in
			''|*' '*|*/*) aethernet_fail 3 "The recorded image tag $aethernet_recorded_tag is not an image tag." ;;
		esac
		aethernet_set_image_tag "$aethernet_recorded_tag"
		aethernet_moved=1
	else
		while read -r aethernet_ref aethernet_id; do
			[ -n "$aethernet_ref" ] || continue
			[ "$aethernet_id" != '-' ] || continue
			if ! $aethernet_engine image inspect --format '{{.Id}}' "$aethernet_id" >/dev/null 2>&1; then
				aethernet_say "$aethernet_ref is gone from this host, so it keeps the image it has now."
				continue
			fi
			if ! $aethernet_engine image tag "$aethernet_id" "$aethernet_ref"; then
				aethernet_fail 3 "Cannot put $aethernet_id back on $aethernet_ref."
			fi
			aethernet_moved=1
		done < "$aethernet_rollback_dir/$AETHERNET_IMAGES_FILE"
	fi
	if [ "$aethernet_moved" -eq 0 ]; then
		aethernet_fail 2 "Nothing in $aethernet_rollback_dir can be put back. The recorded tag is the one in .env and every recorded image has been removed from this host, which a $aethernet_engine image prune does."
	fi

	while read -r aethernet_file; do
		[ -n "$aethernet_file" ] || continue
		if [ -s "$aethernet_rollback_dir/$aethernet_file" ]; then
			cp -p "$aethernet_rollback_dir/$aethernet_file" "$opt_dir/$(aethernet_placed_name "$aethernet_file")"
		elif [ -e "$aethernet_rollback_dir/$aethernet_file" ]; then
			aethernet_fail 3 "$aethernet_rollback_dir/$aethernet_file is empty, so restoring it would replace a working file with nothing. Nothing was restored. Take the file from another record or from the ref the record names."
		fi
	done < "$aethernet_scratch/files"
	aethernet_say "Stack files in $opt_dir are the ones the record holds."

	aethernet_say 'Recreating the stack.'
	if ! $aethernet_engine compose up -d --remove-orphans; then
		aethernet_fail 6 "$aethernet_engine compose up -d failed in $opt_dir. Read $aethernet_engine compose logs there."
	fi
	# The mounted file came back from the record, so its service restarts.
	# Comparing it first would save one restart and cost the reader a reason.
	aethernet_mounted_files > "$aethernet_scratch/restart"
	aethernet_restart_mounted
	aethernet_verify_stack
	aethernet_say "Instance rolled back in $opt_dir."
	if [ -s "$aethernet_rollback_dir/$AETHERNET_DUMP_FILE" ]; then
		aethernet_say "The database did not move. Restore it from $aethernet_rollback_dir/$AETHERNET_DUMP_FILE only when the release you left changed the schema."
	else
		aethernet_say "The database did not move. That record holds no dump, because the upgrade ran with --skip-backup-accept-data-loss, so a release that changed the schema has no way back."
	fi
	exit 0
}

aethernet_preflight
aethernet_validate_options
aethernet_resolve_values

if [ "$opt_update" -eq 1 ] || [ "$opt_rollback" -eq 1 ]; then
	aethernet_require_instance
	aethernet_resolve_ref
	aethernet_require_compose_files
	cd "$opt_dir"
	aethernet_set_project
	if [ "$opt_dry_run" -eq 1 ]; then
		# The dry run downloads into a temporary directory so it can name the
		# files that actually change, the services that actually restart, and a
		# Postgres major that would stop the run. It removes that directory on
		# exit and touches nothing in the working directory.
		aethernet_open_scratch "${TMPDIR:-/tmp}"
		aethernet_stack_files > "$aethernet_scratch/files"
		if [ "$opt_rollback" -eq 1 ]; then
			aethernet_plan_rollback
		else
			aethernet_plan_update
		fi
		exit 0
	fi
	if [ "$opt_rollback" -eq 1 ]; then
		aethernet_run_rollback
	fi
	aethernet_run_update
fi

aethernet_resolve_ref

if [ "$opt_dry_run" -eq 1 ]; then
	aethernet_print_plan
	exit 0
fi

mkdir -p "$opt_dir"
cd "$opt_dir"

if [ -e "$opt_dir/.env" ]; then
	aethernet_fail 3 "$opt_dir/.env exists. Run with --update to upgrade the instance and keep the secrets."
fi

aethernet_open_scratch "$opt_dir"
aethernet_fetch_stack
aethernet_place_stack
aethernet_check_volumes

aethernet_say 'Generating secrets.'
if ! aethernet_generate_vapid; then
	aethernet_fail 5 "Could not generate a VAPID key of the required shape in $AETHERNET_VAPID_ATTEMPTS attempts."
fi
aethernet_write_env
aethernet_say "Wrote $opt_dir/.env, readable by you alone."
aethernet_say 'That .env serves https on 443, which is the only layout this script writes. The .env.example beside it says what to change for any other one.'

if [ "$opt_no_start" -eq 1 ]; then
	aethernet_say "Start the instance with $aethernet_engine compose up -d in $opt_dir."
	aethernet_say 'Open it and create the first admin account. Finish the setup wizard in the same sitting.'
	aethernet_say "Secrets live in $opt_dir/.env. Back that file up."
	exit 0
fi

aethernet_say 'Starting the stack.'
if ! $aethernet_engine compose up -d; then
	aethernet_fail 6 "$aethernet_engine compose up -d failed in $opt_dir. Read $aethernet_engine compose logs there."
fi
aethernet_say 'Waiting for every service to report ready. This takes several minutes on the first start, which pulls eighteen images.'
if ! aethernet_wait_ready; then
	aethernet_fail 6 "The stack is not ready after $AETHERNET_READY_TIMEOUT seconds. Read $aethernet_engine compose logs in $opt_dir."
fi
aethernet_ready_origin=$(aethernet_public_origin)
if [ -z "$aethernet_ready_origin" ]; then
	aethernet_ready_origin="https://$opt_domain"
fi
aethernet_probe "$aethernet_ready_origin"

aethernet_say "Instance ready at $aethernet_ready_origin"
aethernet_say 'Open it and create the first admin account. Finish the setup wizard in the same sitting.'
aethernet_say "Secrets live in $opt_dir/.env. Back that file up."
