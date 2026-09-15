# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Aethernet self-hosting installer and upgrader for Windows.
#
# Three modes, one file:
#
#   default    Check the host, download the stack files, write .env with every value the stack
#              requires, start the containers.
#   -Update    Upgrade an instance that already exists. Record the running images, back up,
#              refresh the stack files, pull, recreate, verify.
#   -Rollback  Put the images and the stack files of the last recorded upgrade back.
#
# Why one script and not a separate upgrader: an upgrade needs the host checks, the stack
# download, the readiness poll and the health probe that the install already carries. A second
# script either copies them or drifts from them, and the operator has two downloads and two
# checksums to verify instead of one.
#
# This file is also the procedure. Every step of the upgrade carries the command an operator
# types to do that step by hand, and the reason the step exists.
#
# Read this file before running it. The default mode writes .env, which holds every secret the
# instance has. The upgrade generates a secret only for a key the refreshed stack requires that
# .env does not hold, and rewrites no secret. The only value either
# upgrade mode ever replaces in .env is AETHERNET_IMAGE_TAG, and only during a rollback that moves
# off a pinned tag.
#
# Rewriting a secret in .env against volumes that already exist is the one thing this script
# could do that an operator cannot undo. A fresh POSTGRES_PASSWORD does not open the existing
# postgres-data volume, and the instance never starts again.
#
# Source:   https://aethernet.dev/install.ps1
# Checksum: https://aethernet.dev/install.ps1.sha256
#
# Every file this script writes uses LF line endings. Docker Compose keeps a trailing carriage
# return as part of a value, so a CRLF .env produces secrets that do not match the ones the
# containers were given.

[CmdletBinding()]
param(
	[string]$Domain = '',
	[string]$Email = '',
	[string]$Dir = '',
	[string]$Engine = '',
	[string]$Ref = '',
	[string]$ImageTag = 'v1',
	[string]$Tls = 'bundled',
	[string]$EdgeBind = '127.0.0.1:8080',
	[string]$BackupDir = '',
	[switch]$NonInteractive,
	[switch]$DryRun,
	[switch]$NoStart,
	[switch]$Update,
	[switch]$Rollback,
	[switch]$NoVolumeBackup,
	[switch]$SkipBackupAcceptDataLoss,
	[switch]$Help,
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]]$Rest = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$AethernetRawBase = 'https://raw.githubusercontent.com/aethernetapp/aethernet'
$AethernetStackPath = 'deploy/self-hosting'
$AethernetHealthPath = '/_health'
$AethernetInitService = 'seaweedfs-init'
$AethernetMinimumPodmanVersion = '5.0.0'
$AethernetMinimumEngineVersion = '24.0.0'
$AethernetMinimumComposeVersion = '2.20.2'
$AethernetReadyTimeoutSeconds = 600
$AethernetReadyIntervalSeconds = 5
$AethernetReadyReportSeconds = 30
$AethernetVapidAttempts = 8

# The image that copies volumes and measures them. Pinned, because an upgrade that reaches for a
# moving tag to take its backup has one more thing that can change under it.
$AethernetHelperImage = 'alpine:3.22'

# Names inside a record directory. A record is one upgrade: what was running, what the stack files
# said, and the backup taken before the images moved. install.sh writes the same names, so either
# script reads a record the other one wrote.
$AethernetRecordPrefix = 'record-'
$AethernetImagesFile = 'images'
$AethernetTagFile = 'image-tag'
$AethernetDumpFile = 'aethernet.dump'

# Free space demanded before a volume copy, as a percentage of the measured volume size. The
# tarball compresses, so this is generous on purpose. A backup that fills the disk it writes to
# takes the instance down with it.
$AethernetVolumeHeadroomPercent = 110

$AethernetExitUsage = 1
$AethernetExitPrerequisite = 2
$AethernetExitRefused = 3
$AethernetExitDownload = 4
$AethernetExitSecret = 5
$AethernetExitUnhealthy = 6
$AethernetExitBackup = 7
$AethernetExitInterrupted = 130

$AethernetStackFiles = @(
	'docker-compose.yml'
	'docker-compose.proxy.yml'
	'tunnel.compose.yml'
	'Caddyfile'
	'.env.example'
)

$AethernetComposeNames = @(
	'compose.yaml'
	'compose.yml'
	'docker-compose.yml'
	'docker-compose.yaml'
)

$script:AethernetComposeBase = 'docker-compose.yml'
$script:AethernetComposeBaseFrom = ''

function Get-AethernetComposeNameIn([string]$Directory) {
	foreach ($name in $AethernetComposeNames) {
		if (Test-Path -LiteralPath (Join-Path $Directory $name)) {
			return $name
		}
	}
	return ''
}

function Get-AethernetPlacedName([string]$Name) {
	if ($Name -eq 'docker-compose.yml') {
		return $script:AethernetComposeBase
	}
	return $Name
}

# The file Compose bind-mounts from the working directory, with the service that mounts it.
# Compose decides whether to recreate a container by comparing its configuration, and the
# contents of a bind-mounted file are not part of that comparison, so a changed Caddyfile survives
# docker compose up -d with the old bytes still loaded in the running container.
#
# By hand, after a refresh that changed the file:
#   docker compose restart edge
$AethernetMountedFiles = @(
	@{Name = 'Caddyfile'; Service = 'edge'}
)

# The volumes an upgrade copies, and the reason the rest are absent.
#
# postgres-data is not here because the dump supersedes it. A custom-format dump restores into the
# major version that wrote it or a newer one, a tarball of the data directory restores only into
# the major that wrote it, and taking both doubles the downtime and the disk for a strictly weaker
# artifact.
#
# valkey-data and nats-data hold queued work, not records. Losing them drops scheduled bulk
# deletions and background jobs, which is degradation rather than loss, and the upgrade never
# removes a volume.
#
# meilisearch-data rebuilds on the next API start, edge-data is one certificate request,
# edge-config is rewritten by Caddy on every start.
#
# seaweedfs-data is the one that matters. It holds every upload, avatar, report and harvest, and
# nothing else in the stack can recreate any of it.
$AethernetBackupVolumes = @(
	'seaweedfs-data'
)

# The keys a refreshed stack requires that an .env written by an older installer does not hold.
# Only keys with no state anywhere else are here. A value like POSTGRES_PASSWORD is matched by a
# password stored inside the database, so minting a new one locks the stack out of its own data
# and it is not listed. CHANGE_ME counts as absent.
$AethernetUpgradeSecretKeys = @(
	@{Name = 'AETHERNET_ERLANG_COOKIE'; Kind = 'hex'}
	@{Name = 'AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64'; Kind = 'base64'}
)

$AethernetSecretKeys = @(
	@{Name = 'POSTGRES_PASSWORD'; Kind = 'hex'}
	@{Name = 'MEILI_MASTER_KEY'; Kind = 'hex'}
	@{Name = 'AETHERNET_S3_SECRET_KEY'; Kind = 'hex'}
	@{Name = 'AETHERNET_SUDO_MODE_SECRET'; Kind = 'hex'}
	@{Name = 'AETHERNET_CONNECTION_INITIATION_SECRET'; Kind = 'hex'}
	@{Name = 'AETHERNET_GATEWAY_RPC_AUTH_TOKEN'; Kind = 'hex'}
	@{Name = 'AETHERNET_ERLANG_COOKIE'; Kind = 'hex'}
	@{Name = 'AETHERNET_MEDIA_PROXY_SECRET_KEY'; Kind = 'hex'}
	@{Name = 'AETHERNET_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64'; Kind = 'base64'}
	@{Name = 'AETHERNET_ADMIN_SECRET_KEY_BASE'; Kind = 'hex'}
	@{Name = 'AETHERNET_ADMIN_OAUTH_CLIENT_SECRET'; Kind = 'hex'}
	@{Name = 'LIVEKIT_API_SECRET'; Kind = 'hex'}
	@{Name = 'AETHERNET_VAPID_PUBLIC_KEY'; Kind = 'vapid_public'}
	@{Name = 'AETHERNET_VAPID_PRIVATE_KEY'; Kind = 'vapid_private'}
)

$AethernetNonSecretKeys = @(
	@{Name = 'AETHERNET_DOMAIN'; Kind = 'domain'; Value = ''}
	@{Name = 'AETHERNET_PUBLIC_SCHEME'; Kind = 'literal'; Value = 'https'}
	@{Name = 'AETHERNET_PUBLIC_PORT'; Kind = 'literal'; Value = '443'}
	@{Name = 'AETHERNET_VAPID_EMAIL'; Kind = 'email'; Value = ''}
	@{Name = 'AETHERNET_IMAGE_TAG'; Kind = 'image_tag'; Value = ''}
	@{Name = 'AETHERNET_S3_ACCESS_KEY'; Kind = 'literal'; Value = 'aethernet'}
	@{Name = 'LIVEKIT_API_KEY'; Kind = 'literal'; Value = 'aethernet'}
)

function Write-AethernetLine([string]$Message) {
	Write-Host $Message
}

function Write-AethernetProblem([string]$Message) {
	[Console]::Error.WriteLine($Message)
}

function Stop-Aethernet([string]$Message, [int]$Code) {
	Write-AethernetProblem $Message
	exit $Code
}

function Show-AethernetUsage {
	Write-AethernetLine 'Usage: install.ps1 -Domain <host> -Email <address> [options]'
	Write-AethernetLine '       install.ps1 -Update [options]'
	Write-AethernetLine '       install.ps1 -Rollback [options]'
	Write-AethernetLine ''
	Write-AethernetLine 'Options:'
	Write-AethernetLine '  -Domain <host>          Hostname the instance answers on. Prompted when absent.'
	Write-AethernetLine '  -Email <address>        Address written as AETHERNET_VAPID_EMAIL. Prompted when absent.'
	Write-AethernetLine '  -Engine <command>       Container engine to drive. Default: docker, or podman when'
	Write-AethernetLine '                          docker is absent.'
	Write-AethernetLine '  -Dir <path>             Working directory. Default: the aethernet folder in the home'
	Write-AethernetLine '                          directory, or the working directory itself when -Update or'
	Write-AethernetLine '                          -Rollback is given and it holds an instance.'
	Write-AethernetLine '  -Ref <git ref>          Ref the stack files come from. Default: the image tag, and main when that tag is v1 or latest.'
	Write-AethernetLine '  -ImageTag <tag>         Value written as AETHERNET_IMAGE_TAG. Default: v1.'
	Write-AethernetLine '  -Tls <bundled|proxy>    Certificate mode. Default: bundled.'
	Write-AethernetLine '  -EdgeBind <addr:port>   Plain HTTP bind under -Tls proxy. Default: 127.0.0.1:8080.'
	Write-AethernetLine '  -NonInteractive         Never prompt. A missing required value exits 1.'
	Write-AethernetLine '  -DryRun                 Print the plan. Change nothing.'
	Write-AethernetLine '  -NoStart                Write everything. Skip docker compose up -d.'
	Write-AethernetLine '  -Update                 Upgrade: record, back up, refresh, pull, recreate, verify.'
	Write-AethernetLine '  -Rollback               Restore the images and stack files of the last record.'
	Write-AethernetLine '  -BackupDir <path>       Where records go. Default: the backups folder under -Dir.'
	Write-AethernetLine '  -NoVolumeBackup         Take the database dump and skip the uploads copy.'
	Write-AethernetLine '  -SkipBackupAcceptDataLoss'
	Write-AethernetLine '                          Upgrade with no backup at all. Losable data is lost.'
	Write-AethernetLine '  -Help                   Print this text.'
	Write-AethernetLine ''
	Write-AethernetLine 'Exit codes: 0 success, 1 usage, 2 prerequisite, 3 refused, 4 download, 5 secret,'
	Write-AethernetLine '6 unhealthy, 7 backup.'
}

function Test-AethernetWindowsHost {
	if ($PSVersionTable.PSVersion.Major -lt 6) {
		return $true
	}
	return $IsWindows
}

function ConvertTo-AethernetVersion([string]$Text) {
	$match = [regex]::Match($Text, '(\d+)\.(\d+)(?:\.(\d+))?')
	if (-not $match.Success) {
		return $null
	}
	$patch = 0
	if ($match.Groups[3].Success) {
		$patch = [int]$match.Groups[3].Value
	}
	return @([int]$match.Groups[1].Value, [int]$match.Groups[2].Value, $patch)
}

function Test-AethernetVersionAtLeast([string]$Found, [string]$Minimum) {
	$left = ConvertTo-AethernetVersion $Found
	$right = ConvertTo-AethernetVersion $Minimum
	if ($null -eq $left) {
		return $false
	}
	for ($index = 0; $index -lt 3; $index++) {
		if ($left[$index] -gt $right[$index]) {
			return $true
		}
		if ($left[$index] -lt $right[$index]) {
			return $false
		}
	}
	return $true
}

# docker writes the reason a command failed to stderr and nothing else ever repeats it, so stderr
# is kept rather than discarded. The two streams stay apart because every caller reads Text as
# data, and one warning line on stderr would be one more line of JSON, one more image reference or
# one more container ID.
$script:AethernetEngine = 'docker'
$script:AethernetEngineLabel = 'Docker Engine'

function Invoke-AethernetCapture([string[]]$CommandArgs) {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	$out = @()
	$err = @()
	$code = 0
	try {
		$output = & $script:AethernetEngine @CommandArgs 2>&1
		$code = $LASTEXITCODE
		foreach ($item in @($output)) {
			if ($item -is [System.Management.Automation.ErrorRecord]) {
				$err += [string]$item
			} else {
				$out += [string]$item
			}
		}
	} finally {
		$ErrorActionPreference = $previous
	}
	return @{Code = $code; Text = (($out -join "`n").Trim()); Error = (($err -join "`n").Trim())}
}

function Invoke-AethernetDocker([string[]]$CommandArgs) {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	$code = 0
	try {
		& $script:AethernetEngine @CommandArgs
		$code = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previous
	}
	return $code
}

# pg_dump writes a binary stream. PowerShell redirection decodes that stream as text and corrupts
# it, so the bytes go to the file through the process itself.
function Invoke-AethernetDockerToFile([string[]]$CommandArgs, [string]$OutFile, [string]$WorkingDir) {
	$errorFile = "$OutFile.stderr"
	$process = Start-Process -FilePath $script:AethernetEngine -ArgumentList $CommandArgs -RedirectStandardOutput $OutFile -RedirectStandardError $errorFile -WorkingDirectory $WorkingDir -NoNewWindow -Wait -PassThru
	$code = $process.ExitCode
	if (Test-Path -LiteralPath $errorFile) {
		Remove-Item -LiteralPath $errorFile -Force
	}
	return $code
}

function Test-AethernetWsl2 {
	$command = Get-Command wsl.exe -ErrorAction SilentlyContinue
	if ($null -eq $command) {
		return $false
	}
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	$code = 1
	try {
		& wsl.exe --status 2>&1 | Out-Null
		$code = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previous
	}
	return ($code -eq 0)
}

function Invoke-AethernetPreflight {
	if ($PSVersionTable.PSVersion.Major -lt 5) {
		Stop-Aethernet 'This installer needs Windows PowerShell 5.1 or PowerShell 7 or newer.' $AethernetExitPrerequisite
	}
	if (-not (Test-AethernetWindowsHost)) {
		Stop-Aethernet 'This installer runs on Windows. On Linux and macOS run install.sh instead.' $AethernetExitPrerequisite
	}
	if ($PSVersionTable.PSVersion.Major -lt 6) {
		[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
	}
	if ($Engine.Length -gt 0) {
		$script:AethernetEngine = $Engine
	} elseif ($null -ne (Get-Command docker -ErrorAction SilentlyContinue)) {
		$script:AethernetEngine = 'docker'
	} elseif ($null -ne (Get-Command podman -ErrorAction SilentlyContinue)) {
		$script:AethernetEngine = 'podman'
	} else {
		Stop-Aethernet 'Neither docker nor podman is on PATH. Install Docker Desktop with the WSL2 backend, or pass -Engine with the command that drives your containers.' $AethernetExitPrerequisite
	}
	if ($null -eq (Get-Command $script:AethernetEngine -ErrorAction SilentlyContinue)) {
		Stop-Aethernet "$($script:AethernetEngine) is not on PATH. Pass -Engine with the command that drives your containers." $AethernetExitPrerequisite
	}
	# Every engine that speaks the Docker CLI reports itself as "<name> version X",
	# and Podman's 5.x is not Docker's 5.x, so the floor has to belong to whichever
	# one answered.
	$reported = Invoke-AethernetCapture @('--version')
	$minimumEngine = $AethernetMinimumEngineVersion
	if ($reported.Code -eq 0 -and $reported.Text -match '^\s*podman\s+version') {
		$script:AethernetEngineLabel = 'Podman'
		$minimumEngine = $AethernetMinimumPodmanVersion
	}
	$engine = Invoke-AethernetCapture @('version', '--format', '{{.Server.Version}}')
	if ($engine.Code -ne 0) {
		Stop-Aethernet "$($script:AethernetEngine) does not answer. Start it and run this script again." $AethernetExitPrerequisite
	}
	$compose = Invoke-AethernetCapture @('compose', 'version', '--short')
	if ($compose.Code -ne 0) {
		Stop-Aethernet 'The Docker Compose v2 plugin is missing. Docker Desktop ships it.' $AethernetExitPrerequisite
	}
	if (-not (Test-AethernetVersionAtLeast $engine.Text $minimumEngine)) {
		Stop-Aethernet "$($script:AethernetEngineLabel) $($engine.Text) is older than $minimumEngine. Compose is $($compose.Text)." $AethernetExitPrerequisite
	}
	if (-not (Test-AethernetVersionAtLeast $compose.Text $AethernetMinimumComposeVersion)) {
		Stop-Aethernet "Compose $($compose.Text) is older than $AethernetMinimumComposeVersion. $($script:AethernetEngineLabel) is $($engine.Text)." $AethernetExitPrerequisite
	}
	$osType = Invoke-AethernetCapture @('info', '--format', '{{.OSType}}')
	if ($osType.Code -ne 0) {
		Stop-Aethernet 'The Docker daemon does not report its container platform.' $AethernetExitPrerequisite
	}
	if ($osType.Text -ne 'linux') {
		Stop-Aethernet "Docker runs $($osType.Text) containers. Switch Docker Desktop to Linux containers." $AethernetExitPrerequisite
	}
	Write-AethernetLine "$($script:AethernetEngineLabel) $($engine.Text) and Compose $($compose.Text) are ready."
	if (-not (Test-AethernetWsl2)) {
		Write-AethernetLine 'WSL 2 is not present. Docker Desktop with the WSL2 backend is the supported Windows setup.'
	}
}

function Assert-AethernetDomain([string]$Value) {
	if ($Value -cmatch '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') {
		return
	}
	Stop-Aethernet "-Domain must be a lowercase hostname such as chat.example.com. Got: $Value" $AethernetExitUsage
}

function Assert-AethernetEmail([string]$Value) {
	if ($Value -match '^[^@\s]+@[^@\s]+$') {
		return
	}
	Stop-Aethernet "-Email must be one address such as you@example.com. Got: $Value" $AethernetExitUsage
}

function Get-AethernetRefForTag([string]$Tag) {
	if ($Tag -eq 'v1' -or $Tag -eq 'latest') {
		return 'main'
	}
	return $Tag
}

# The images come from AETHERNET_IMAGE_TAG and the stack files come from a git ref. A release tags its
# images and its commit with the same CalVer string, so a pinned tag names the commit that carries
# its compose files. The moving tags v1 and latest track main.
function Assert-AethernetDerivedRef([string]$Value, [string]$EnvPath) {
	if ($Value.Length -eq 0) {
		Stop-Aethernet "$EnvPath declares no AETHERNET_IMAGE_TAG, so no ref can be derived. Pass -Ref." $AethernetExitRefused
	}
	if ($Value -match '\s' -or $Value -match '(^|/)\.\.(/|$)') {
		Stop-Aethernet "AETHERNET_IMAGE_TAG is $Value, which is not a git ref. Pass -Ref." $AethernetExitRefused
	}
}

function Assert-AethernetRef([string]$Value) {
	if ($Value.Length -eq 0) {
		return
	}
	if ($Value -match '\s') {
		Stop-Aethernet '-Ref must not contain whitespace.' $AethernetExitUsage
	}
	if ($Value -match '(^|/)\.\.(/|$)') {
		Stop-Aethernet '-Ref must not contain a parent segment.' $AethernetExitUsage
	}
}

function Assert-AethernetEdgeBind([string]$Value) {
	if ($Value -match '^\S+:\d{1,5}$') {
		return
	}
	Stop-Aethernet "-EdgeBind must be an address and port such as 127.0.0.1:8080. Got: $Value" $AethernetExitUsage
}

function Read-AethernetValue([string]$Prompt) {
	for ($attempt = 0; $attempt -lt 3; $attempt++) {
		$answer = Read-Host -Prompt $Prompt
		if ($null -ne $answer) {
			$answer = $answer.Trim()
			if ($answer.Length -gt 0) {
				return $answer
			}
		}
	}
	Stop-Aethernet 'Three empty answers. Nothing was written.' $AethernetExitUsage
}

function Resolve-AethernetValue([string]$Value, [string]$Prompt, [string]$Flag, [bool]$AllowPrompt) {
	if ($Value.Length -gt 0) {
		return $Value
	}
	if (-not $AllowPrompt) {
		Stop-Aethernet "$Flag is required." $AethernetExitUsage
	}
	return Read-AethernetValue $Prompt
}

function New-AethernetRandomBytes([int]$Count) {
	$bytes = New-Object byte[] $Count
	$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
	try {
		$generator.GetBytes($bytes)
	} finally {
		$generator.Dispose()
	}
	return ,$bytes
}

function ConvertTo-AethernetHex([byte[]]$Bytes) {
	return [System.BitConverter]::ToString($Bytes).Replace('-', '').ToLowerInvariant()
}

function ConvertTo-AethernetBase64Url([byte[]]$Bytes) {
	$text = [System.Convert]::ToBase64String($Bytes)
	return $text.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

# The VAPID pair is the one secret in .env that no random draw produces.
# AETHERNET_VAPID_PUBLIC_KEY is base64url of the 65-byte uncompressed P-256 point and
# AETHERNET_VAPID_PRIVATE_KEY is base64url of its 32-byte scalar. The stack requires both even when
# nobody enables browser notifications. The private key is 43 characters and the public key is 87.
#
# By hand on a host with openssl:
#   openssl ecparam -name prime256v1 -genkey -noout -out vapid.pem
#   openssl ec -in vapid.pem -outform DER | od -An -tx1 -N7 | tr -d ' \n'
#   The line above must print 30770201010420. Any other value means a short
#   scalar, so delete vapid.pem and draw again before going on.
#   openssl ec -in vapid.pem -outform DER | tail -c +8 | head -c 32 | openssl base64 -A | tr '+/' '-_' | tr -d '='
#   openssl ec -in vapid.pem -pubout -outform DER | tail -c 65 | openssl base64 -A | tr '+/' '-_' | tr -d '='
function New-AethernetVapidPair {
	for ($attempt = 0; $attempt -lt $AethernetVapidAttempts; $attempt++) {
		$key = $null
		$parameters = $null
		try {
			$curve = [System.Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256')
			$key = [System.Security.Cryptography.ECDsa]::Create($curve)
			$parameters = $key.ExportParameters($true)
		} catch {
			Stop-Aethernet 'The .NET P-256 provider is unavailable. Install .NET Framework 4.7.2 or newer, or run this script under PowerShell 7.' $AethernetExitSecret
		} finally {
			if ($null -ne $key) {
				$key.Dispose()
			}
		}
		if ($parameters.D.Length -ne 32) {
			continue
		}
		if ($parameters.Q.X.Length -ne 32) {
			continue
		}
		if ($parameters.Q.Y.Length -ne 32) {
			continue
		}
		$point = New-Object byte[] 65
		$point[0] = 4
		[System.Array]::Copy($parameters.Q.X, 0, $point, 1, 32)
		[System.Array]::Copy($parameters.Q.Y, 0, $point, 33, 32)
		$public = ConvertTo-AethernetBase64Url $point
		$private = ConvertTo-AethernetBase64Url $parameters.D
		if ($public.Length -ne 87) {
			continue
		}
		if ($private.Length -ne 43) {
			continue
		}
		return @{Public = $public; Private = $private}
	}
	Stop-Aethernet "The P-256 provider returned $AethernetVapidAttempts keys of the wrong size. Nothing was written." $AethernetExitSecret
}

function ConvertTo-AethernetLfFile([string]$Path) {
	$bytes = [System.IO.File]::ReadAllBytes($Path)
	$output = New-Object System.Collections.Generic.List[byte]
	for ($index = 0; $index -lt $bytes.Length; $index++) {
		if ($bytes[$index] -eq 13) {
			if (($index + 1) -lt $bytes.Length) {
				if ($bytes[$index + 1] -eq 10) {
					continue
				}
			}
		}
		$output.Add($bytes[$index])
	}
	if ($output.Count -eq $bytes.Length) {
		return
	}
	[System.IO.File]::WriteAllBytes($Path, $output.ToArray())
}

function Set-AethernetPrivateFile([string]$Path) {
	$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
	$acl = Get-Acl -Path $Path
	$acl.SetAccessRuleProtection($true, $false)
	foreach ($rule in @($acl.Access)) {
		[void]$acl.RemoveAccessRule($rule)
	}
	$owner = New-Object System.Security.AccessControl.FileSystemAccessRule($identity.User, 'FullControl', 'Allow')
	$acl.AddAccessRule($owner)
	Set-Acl -Path $Path -AclObject $acl
}

# A record holds a copy of .env, so the directory itself is closed to everyone but the account
# that took it.
function Set-AethernetPrivateDirectory([string]$Path) {
	$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
	$acl = Get-Acl -Path $Path
	$acl.SetAccessRuleProtection($true, $false)
	foreach ($rule in @($acl.Access)) {
		[void]$acl.RemoveAccessRule($rule)
	}
	$owner = New-Object System.Security.AccessControl.FileSystemAccessRule($identity.User, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
	$acl.AddAccessRule($owner)
	Set-Acl -Path $Path -AclObject $acl
}

function Remove-AethernetTemporary([string]$Path) {
	if (Test-Path -LiteralPath $Path) {
		Remove-Item -LiteralPath $Path -Force
	}
}

function New-AethernetStagingDirectory([string]$Parent) {
	$staging = Join-Path $Parent ".aethernet-install.$PID"
	if (Test-Path -LiteralPath $staging) {
		Remove-Item -LiteralPath $staging -Recurse -Force
	}
	New-Item -ItemType Directory -Path $staging -Force | Out-Null
	return $staging
}

function Remove-AethernetStagingDirectory([string]$Path) {
	if ($Path.Length -gt 0 -and (Test-Path -LiteralPath $Path)) {
		Remove-Item -LiteralPath $Path -Recurse -Force
	}
}

# By hand, for one file:
#   Invoke-WebRequest -Uri https://raw.githubusercontent.com/aethernetapp/aethernet/main/deploy/self-hosting/docker-compose.yml -OutFile docker-compose.yml
#
# The files come from a git ref and the images come from AETHERNET_IMAGE_TAG. The ref is derived from
# the tag unless -Ref names one, which is the pairing rule that stops a compose file from asking for
# a variable the running images do not read.
#
# Everything lands in a staging directory first, so a failed download leaves the working directory
# on the set it already had, and so the upgrade can compare old against new before replacing.
function Get-AethernetStackFiles([string]$StagingDir, [string]$RefValue) {
	$base = "$AethernetRawBase/$RefValue/$AethernetStackPath"
	foreach ($name in $AethernetStackFiles) {
		$destination = Join-Path $StagingDir $name
		try {
			Invoke-WebRequest -Uri "$base/$name" -OutFile $destination -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 120
		} catch {
			Stop-Aethernet "Download failed: $base/$name. Pass -Ref to name the ref the stack files come from." $AethernetExitDownload
		}
		if ((Get-Item -LiteralPath $destination).Length -eq 0) {
			Stop-Aethernet "Download returned an empty file: $name" $AethernetExitDownload
		}
		ConvertTo-AethernetLfFile $destination
		if ($name -eq 'docker-compose.yml') {
			$content = [System.IO.File]::ReadAllText($destination)
			if ($content -notmatch '(?m)^services:') {
				Stop-Aethernet "docker-compose.yml from $RefValue holds no services block." $AethernetExitDownload
			}
		}
		Write-AethernetLine "Downloaded $name"
	}
}

# None of these files is part of an image, and all four are read from the working directory, so
# docker compose pull never updates any of them. That is why an upgrade refreshes them itself.
#
# A refreshed docker-compose.yml can declare a variable the running .env does not carry. Compose
# writes ${NAME:?message} for a variable the stack requires and stops with that message until .env
# sets it, and ${NAME:-default} for one that needs nothing from the operator. Every optional
# override ships commented out in .env.example, so a new required key is the only kind that asks
# for an edit.
function Move-AethernetStackFiles([string]$StagingDir, [string]$TargetDir) {
	foreach ($name in $AethernetStackFiles) {
		Move-Item -LiteralPath (Join-Path $StagingDir $name) -Destination (Join-Path $TargetDir (Get-AethernetPlacedName $name)) -Force
	}
}

# The same file by hand, which is what the caller of this function does in one pass:
#
#   Copy-Item .env.example .env
#
# Close .env to every account but your own, then set AETHERNET_DOMAIN and AETHERNET_VAPID_EMAIL, the two
# values only the operator knows. The five other non-secret keys in the list above ship correct in
# .env.example and need no edit.
#
# Every secret in .env.example carries the literal CHANGE_ME. A key whose name ends in _BASE64
# takes 32 random bytes as base64, every other key takes 32 random bytes as hex, and the VAPID pair
# comes from the generator above.
#
# Under -Tls proxy, COMPOSE_FILE and AETHERNET_EDGE_BIND already sit in .env.example as commented
# lines, so by hand they are uncommented rather than added.
function Write-AethernetEnvFile([string]$Path, [string[]]$Lines) {
	$temporary = "$Path.new"
	Remove-AethernetTemporary $temporary
	$encoding = New-Object System.Text.UTF8Encoding($false)
	[System.IO.File]::WriteAllText($temporary, '', $encoding)
	Set-AethernetPrivateFile $temporary
	$text = ($Lines -join "`n") + "`n"
	[System.IO.File]::WriteAllText($temporary, $text, $encoding)
	Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Get-AethernetEnvLines([string]$EnvPath) {
	$text = [System.IO.File]::ReadAllText($EnvPath)
	return $text.Replace("`r`n", "`n").TrimEnd("`n").Split("`n")
}

function Get-AethernetEnvValue([string]$EnvPath, [string]$Name) {
	foreach ($line in Get-AethernetEnvLines $EnvPath) {
		if ($line.StartsWith("$Name=")) {
			return $line.Substring($Name.Length + 1)
		}
	}
	return ''
}

function Get-AethernetProperty($Row, [string]$Name) {
	$property = $Row.PSObject.Properties[$Name]
	if ($null -eq $property) {
		return ''
	}
	if ($null -eq $property.Value) {
		return ''
	}
	return [string]$property.Value
}

function Get-AethernetComposeRows {
	$result = Invoke-AethernetCapture @('compose', 'ps', '--all', '--format', 'json')
	if ($result.Code -ne 0) {
		return @()
	}
	$text = $result.Text
	if ($text.Length -eq 0) {
		return @()
	}
	$rows = @()
	if ($text.StartsWith('[')) {
		$rows = @($text | ConvertFrom-Json)
		return $rows
	}
	foreach ($line in $text.Split("`n")) {
		$candidate = $line.Trim()
		if ($candidate.Length -eq 0) {
			continue
		}
		$rows += ($candidate | ConvertFrom-Json)
	}
	return $rows
}

function Measure-AethernetReadyRows($Rows) {
	$ready = 0
	foreach ($row in $Rows) {
		$service = Get-AethernetProperty $row 'Service'
		$state = Get-AethernetProperty $row 'State'
		$health = Get-AethernetProperty $row 'Health'
		if ($service -eq $AethernetInitService) {
			if ($state -eq 'exited') {
				if ((Get-AethernetProperty $row 'ExitCode') -eq '0') {
					$ready++
				}
			}
			continue
		}
		if ($state -ne 'running') {
			continue
		}
		if ($health.Length -gt 0) {
			if ($health -ne 'healthy') {
				continue
			}
		}
		$ready++
	}
	return $ready
}

# Readiness comes from Compose state, which is local and authoritative.
#
# By hand:
#   docker compose ps
#
# Every service reads running or healthy except seaweedfs-init, which reads exited (0) because it
# is a one-shot bucket initialiser.
function Wait-AethernetStack([string]$Lead) {
	Write-AethernetLine $Lead
	$deadline = (Get-Date).AddSeconds($AethernetReadyTimeoutSeconds)
	$reportAt = (Get-Date).AddSeconds($AethernetReadyReportSeconds)
	while ((Get-Date) -lt $deadline) {
		$rows = @(Get-AethernetComposeRows)
		if ($rows.Count -gt 0) {
			$ready = Measure-AethernetReadyRows $rows
			if ($ready -eq $rows.Count) {
				Write-AethernetLine "All $($rows.Count) services report healthy."
				return
			}
			if ((Get-Date) -ge $reportAt) {
				Write-AethernetLine "$ready of $($rows.Count) services are ready."
				$reportAt = (Get-Date).AddSeconds($AethernetReadyReportSeconds)
			}
		}
		Start-Sleep -Seconds $AethernetReadyIntervalSeconds
	}
	Stop-Aethernet "The stack did not report healthy within $AethernetReadyTimeoutSeconds seconds. Read docker compose ps and docker compose logs." $AethernetExitUnhealthy
}

# The origin browsers use. .env states it outright when AETHERNET_PUBLIC_ORIGIN is set, and Compose
# otherwise builds the same string from the scheme, the domain and the port, dropping a port that
# is the default for its scheme.
#
# Compose expands a ${...} reference inside an .env value and this script does not, so a
# AETHERNET_PUBLIC_ORIGIN written that way is skipped rather than printed back with the braces still
# in it. The three names below say the same address, so the derived string is the right one to
# fall back to.
#
# By hand:
#   Select-String -Path .env -Pattern '^AETHERNET_(PUBLIC_ORIGIN|PUBLIC_SCHEME|DOMAIN|PUBLIC_PORT)='
function Get-AethernetPublicOrigin([string]$EnvPath) {
	$origin = Get-AethernetEnvValue $EnvPath 'AETHERNET_PUBLIC_ORIGIN'
	if ($origin.Contains('${')) {
		Write-AethernetProblem 'AETHERNET_PUBLIC_ORIGIN in .env holds a ${...} reference. This script does not expand those, so the address below comes from AETHERNET_PUBLIC_SCHEME, AETHERNET_DOMAIN and AETHERNET_PUBLIC_PORT instead.'
		$origin = ''
	}
	if ($origin.Length -gt 0) {
		return $origin.TrimEnd('/')
	}
	$originHost = Get-AethernetEnvValue $EnvPath 'AETHERNET_DOMAIN'
	if ($originHost.Length -eq 0) {
		return ''
	}
	$scheme = Get-AethernetEnvValue $EnvPath 'AETHERNET_PUBLIC_SCHEME'
	if ($scheme.Length -eq 0) {
		$scheme = 'https'
	}
	$port = Get-AethernetEnvValue $EnvPath 'AETHERNET_PUBLIC_PORT'
	$suffix = ''
	if ($port.Length -gt 0 -and -not (($scheme -eq 'http' -and $port -eq '80') -or ($scheme -eq 'https' -and $port -eq '443'))) {
		$suffix = ":$port"
	}
	return "${scheme}://${originHost}${suffix}"
}

# The public probe is informational. A host behind hairpin NAT cannot always reach its own
# hostname, and a false failure there would be worse than no probe. It asks the origin .env
# advertises, so an instance on a non-default port is probed where it actually answers.
function Test-AethernetPublicHealth([string]$Origin) {
	$url = "$Origin$AethernetHealthPath"
	$authority = $Origin
	$separator = $Origin.IndexOf('://')
	if ($separator -ge 0) {
		$authority = $Origin.Substring($separator + 3)
	}
	$probeHost = $authority
	$probePort = if ($Origin.StartsWith('http://')) { '80' } else { '443' }
	$colon = $authority.IndexOf(':')
	if ($colon -ge 0) {
		$probeHost = $authority.Substring(0, $colon)
		$probePort = $authority.Substring($colon + 1)
	}
	try {
		$response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
		Write-AethernetLine "$url returned $([int]$response.StatusCode)."
	} catch {
		Write-AethernetLine "$url did not answer with 200. Confirm the DNS record for $probeHost and that inbound port $probePort reaches this host."
	}
}

function Get-AethernetComposeProject([string]$TargetDir) {
	if ($null -ne $env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME.Length -gt 0) {
		return $env:COMPOSE_PROJECT_NAME
	}
	foreach ($line in [System.IO.File]::ReadAllText((Join-Path $TargetDir $script:AethernetComposeBase)).Split("`n")) {
		if ($line -match '^name:\s*(\S+)') {
			return $Matches[1]
		}
	}
	return ''
}

$script:AethernetComposeOut = ''
$script:AethernetComposeSelector = ''
$script:AethernetComposeErr = ''

# One read-only Compose query, with what Compose printed on stderr kept.
#
# Compose loads the whole file set and interpolates every variable in it before it answers either
# query below. A file that is not there, a file it cannot read and a required variable .env does
# not set all fail at that point, and the stderr text is the only thing that says which of them it
# was.
function Invoke-AethernetComposeQuery([string]$Selector) {
	$result = Invoke-AethernetCapture @('compose', 'config', $Selector)
	$script:AethernetComposeOut = $result.Text
	$script:AethernetComposeErr = $result.Error
	$script:AethernetComposeSelector = $Selector
	return $result.Code
}

# The two readers below parse whatever the last query returned, so each one names
# the selector it belongs to. Reading the wrong one would otherwise hand back the
# other kind of list with nothing to say it was wrong.
function Assert-AethernetComposeSelector([string]$Selector) {
	if ($script:AethernetComposeSelector -ne $Selector) {
		Stop-Aethernet "Internal error: read of $Selector after a $($script:AethernetComposeSelector) query." $AethernetExitSecret
	}
}

# What Compose printed on the last query, indented one level for the caller.
function Get-AethernetComposeError([string]$Indent) {
	if ($script:AethernetComposeErr.Length -eq 0) {
		return "${Indent}nothing"
	}
	return (($script:AethernetComposeErr.Split("`n") | ForEach-Object {"$Indent$_"}) -join "`n")
}

# The image references the stack resolves to, deduplicated, from the last query. Compose expands
# them from docker-compose.yml and .env, so this is the same resolution docker compose pull
# performs. It names the images, not the versions of them.
#
# By hand:
#   docker compose config --images
function Get-AethernetComposeImages {
	Assert-AethernetComposeSelector '--images'
	$refs = @()
	foreach ($line in $script:AethernetComposeOut.Split("`n")) {
		$candidate = $line.Trim()
		if ($candidate.Length -gt 0) {
			$refs += $candidate
		}
	}
	return @($refs | Sort-Object -Unique)
}

function Get-AethernetImageId([string]$Reference) {
	$result = Invoke-AethernetCapture @('image', 'inspect', '--format', '{{.Id}}', $Reference)
	if ($result.Code -ne 0) {
		return ''
	}
	return $result.Text
}

# The image ID each container was actually created from, against the reference Compose created it
# under.
#
# docker image inspect <reference> answers a different question: what that tag points at on this
# host now. The two disagree whenever a newer image already sits under a moving tag, which is the
# state an upgrade that pulled and then failed leaves behind, and that is the state the operator
# re-runs -Update from. Reading the tag there records the image the stack is about to move to as
# the image it is moving from, and the rollback that follows puts back what is already running
# while reporting success.
#
# By hand:
#   docker compose ps -aq | xargs docker inspect --format '{{.Config.Image}} {{.Image}}'
# The text of a captured stream, indented one level for the caller, or a word
# saying there was none.
function Get-AethernetIndented([string]$Text, [string]$Indent) {
	if ([string]::IsNullOrWhiteSpace($Text)) {
		return "${Indent}nothing"
	}
	return (($Text -split "`n") | ForEach-Object {"$Indent$_"}) -join "`n"
}

function Get-AethernetRunningImageIds {
	$ids = Invoke-AethernetCapture @('compose', 'ps', '-aq')
	$map = @{}
	if ($ids.Code -ne 0) {
		Stop-Aethernet "docker compose ps failed, so what is running cannot be read and the record would name no image ID at all. Compose printed:`n$(Get-AethernetIndented $ids.Error '  ')" $AethernetExitPrerequisite
	}
	if ($ids.Text.Length -eq 0) {
		return $map
	}
	foreach ($container in $ids.Text.Split("`n")) {
		$candidate = $container.Trim()
		if ($candidate.Length -eq 0) {
			continue
		}
		$row = Invoke-AethernetCapture @('inspect', '--format', '{{.Config.Image}} {{.Image}}', $candidate)
		if ($row.Code -ne 0) {
			Stop-Aethernet "docker inspect failed for $candidate, so the image ID under its reference cannot be read and a rollback would have nothing to go back to. Docker printed:`n$(Get-AethernetIndented $row.Error '  ')" $AethernetExitPrerequisite
		}
		$parts = $row.Text.Trim().Split(' ')
		if ($parts.Count -lt 2) {
			continue
		}
		if (-not $map.ContainsKey($parts[0])) {
			$map[$parts[0]] = $parts[1]
		}
	}
	return $map
}

function Get-AethernetRunningImageId($Running, [string]$Reference) {
	if ($null -ne $Running -and $Running.ContainsKey($Reference)) {
		return [string]$Running[$Reference]
	}
	return ''
}

function Get-AethernetPostgresMajor([string]$Path) {
	if (-not (Test-Path -LiteralPath $Path)) {
		return ''
	}
	foreach ($line in [System.IO.File]::ReadAllText($Path).Split("`n")) {
		if ($line -match '^\s*image:\s*postgres:(\d+)') {
			return $Matches[1]
		}
	}
	return ''
}

# -Force, because Get-Item without it returns nothing for a file the filesystem marks hidden while
# Test-Path still reports that file as present, and the pair reads as a file of zero bytes.
function Get-AethernetFileLength([string]$Path) {
	$item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
	if ($null -eq $item -or $item.PSIsContainer) {
		return 0
	}
	return [long]$item.Length
}

function Test-AethernetSameFile([string]$Left, [string]$Right) {
	if (-not (Test-Path -LiteralPath $Left)) {
		return $false
	}
	if (-not (Test-Path -LiteralPath $Right)) {
		return $false
	}
	return ((Get-FileHash -LiteralPath $Left -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $Right -Algorithm SHA256).Hash)
}

# Which mounted files the refresh changes, and therefore which services need a restart rather than
# a recreate. The comparison happens while the new copies are still staged, because once they are
# in place the old bytes are gone.
function Get-AethernetChangedMounts([string]$TargetDir, [string]$StagingDir) {
	$changed = @()
	foreach ($entry in $AethernetMountedFiles) {
		$current = Join-Path $TargetDir $entry.Name
		$fresh = Join-Path $StagingDir $entry.Name
		if (-not (Test-Path -LiteralPath $current)) {
			continue
		}
		if (-not (Test-AethernetSameFile $current $fresh)) {
			$changed += $entry
		}
	}
	return @($changed)
}

# The service names the docker-compose.yml in place defines.
#
# A rollback puts back the stack files the record holds, and a record taken before a service was
# renamed names the old service. Restarting a service the file in place does not define fails, so
# the name is checked first.
#
# By hand:
#   docker compose config --services
function Get-AethernetComposeServices {
	Assert-AethernetComposeSelector '--services'
	$services = @()
	foreach ($line in $script:AethernetComposeOut.Split("`n")) {
		$candidate = $line.Trim()
		if ($candidate.Length -gt 0) {
			$services += $candidate
		}
	}
	return @($services)
}

function Restart-AethernetMounts($Entries, [string]$TargetDir) {
	if (@($Entries).Count -eq 0) {
		return
	}
	if ((Invoke-AethernetComposeQuery '--services') -ne 0) {
		Stop-Aethernet "docker compose config --services failed in $TargetDir, so the services that mount a refreshed file cannot be restarted. Compose printed:`n$(Get-AethernetComposeError '  ')" $AethernetExitUnhealthy
	}
	$services = @(Get-AethernetComposeServices)
	foreach ($entry in $Entries) {
		if ($services -notcontains $entry.Service) {
			Write-AethernetLine "Skipping the restart of $($entry.Service), because the $($script:AethernetComposeBase) in $TargetDir defines no service by that name."
			continue
		}
		Write-AethernetLine "Restarting $($entry.Service), because $($entry.Name) is mounted into it and up -d does not reload a mounted file."
		$code = Invoke-AethernetDocker @('compose', 'restart', $entry.Service)
		if ($code -ne 0) {
			Stop-Aethernet "docker compose restart $($entry.Service) failed." $AethernetExitUnhealthy
		}
	}
}

# A record is created before the upgrade touches anything, so a run that refuses or fails after
# this point still leaves one behind. Such a record describes the state the instance is already
# in, which makes a rollback to it a no-op rather than a mistake. Only the newest record is ever
# used.
function New-AethernetRecord([string]$BackupRoot) {
	if (-not (Test-Path -LiteralPath $BackupRoot)) {
		New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
	}
	Set-AethernetPrivateDirectory $BackupRoot
	$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
	$record = Join-Path $BackupRoot "$AethernetRecordPrefix$stamp"
	if (Test-Path -LiteralPath $record) {
		Stop-Aethernet "$record exists already." $AethernetExitRefused
	}
	New-Item -ItemType Directory -Path $record -Force | Out-Null
	Set-AethernetPrivateDirectory $record
	return $record
}

function Get-AethernetRecordTag([string]$Record) {
	$path = Join-Path $Record $AethernetTagFile
	if (-not (Test-Path -LiteralPath $path)) {
		return ''
	}
	$lines = @(Get-Content -LiteralPath $path -TotalCount 1)
	if ($lines.Count -eq 0 -or $null -eq $lines[0]) {
		return ''
	}
	return ([string]$lines[0]).Trim()
}

function Set-AethernetEnvValue([string]$EnvPath, [string]$Name, [string]$Value) {
	$lines = @(Get-AethernetEnvLines $EnvPath)
	$written = $false
	$out = @()
	foreach ($line in $lines) {
		if ($line.StartsWith("$Name=")) {
			$out += "$Name=$Value"
			$written = $true
		} else {
			$out += $line
		}
	}
	if (-not $written) {
		$out += "$Name=$Value"
	}
	Write-AethernetEnvFile $EnvPath $out
}

# Step 0 of an upgrade: mint the values the refreshed stack requires.
#
# Compose stops on a ${NAME:?} it cannot resolve, so a key the running .env does not hold fails
# every command this script runs before it reaches the step that would have reported it. Writing
# the value first is what makes the rest of the run possible. This runs before the record, so the
# .env the record saves is the one that works.
# The keys the run would write, without writing any of them. The plan and the run
# read the same list, so a plan cannot describe a run that does something else.
function Get-AethernetMissingRequiredSecrets([string]$EnvPath) {
	$missing = @()
	foreach ($entry in $AethernetUpgradeSecretKeys) {
		$current = Get-AethernetEnvValue $EnvPath $entry.Name
		if ($current.Length -eq 0 -or $current -eq 'CHANGE_ME') {
			$missing += $entry.Name
		}
	}
	return @($missing)
}

# A plan writes nothing itself. The run it describes writes .env before it reads
# anything when a required key is absent, and saying otherwise would describe a
# different run.
function Write-AethernetPlanFooter($Missing) {
	if ($Missing.Count -gt 0) {
		Write-AethernetLine 'This plan wrote nothing. The run it describes writes the keys above into .env before anything else.'
	} else {
		Write-AethernetLine 'Nothing outside a temporary directory was written.'
	}
}

function Add-AethernetRequiredSecrets([string]$EnvPath) {
	foreach ($entry in $AethernetUpgradeSecretKeys) {
		$current = Get-AethernetEnvValue $EnvPath $entry.Name
		if ($current.Length -ne 0 -and $current -ne 'CHANGE_ME') {
			continue
		}
		$value = ''
		if ($entry.Kind -eq 'hex') {
			$value = ConvertTo-AethernetHex (New-AethernetRandomBytes 32)
		} elseif ($entry.Kind -eq 'base64') {
			$value = [System.Convert]::ToBase64String((New-AethernetRandomBytes 32))
		} else {
			Stop-Aethernet "Unknown secret kind $($entry.Kind) for $($entry.Name)." $AethernetExitSecret
		}
		if ($value.Length -eq 0) {
			Stop-Aethernet "Generated an empty value for $($entry.Name)." $AethernetExitSecret
		}
		Set-AethernetEnvValue $EnvPath $entry.Name $value
		Write-AethernetLine "Wrote $($entry.Name) into .env. The refreshed stack requires it and this instance held no usable value."
	}
}

function Get-AethernetNewestRecord([string]$BackupRoot) {
	if (-not (Test-Path -LiteralPath $BackupRoot)) {
		return ''
	}
	$records = @(Get-ChildItem -LiteralPath $BackupRoot -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name.StartsWith($AethernetRecordPrefix)} | Sort-Object -Property Name)
	if ($records.Count -eq 0) {
		return ''
	}
	return $records[$records.Count - 1].FullName
}

function Write-AethernetTextFile([string]$Path, [string[]]$Lines) {
	$encoding = New-Object System.Text.UTF8Encoding($false)
	$text = ($Lines -join "`n") + "`n"
	[System.IO.File]::WriteAllText($Path, $text, $encoding)
}

# Step 1 of an upgrade: record what is running before anything moves.
#
# AETHERNET_IMAGE_TAG defaults to v1, which tracks the latest compatible release. The tag therefore
# reads v1 before and after the upgrade, and the image ID is the only thing that tells two
# releases apart. That is what makes this record the version history the stack does not otherwise
# keep, and what makes a rollback possible on a moving tag.
#
# The reference list comes from Compose and the ID under each reference comes from the container
# running it, for the reason in Get-AethernetRunningImageIds. A reference no container carries is
# recorded as `-`, which a rollback skips, because a version that was not running is not a version
# to go back to.
#
# By hand:
#   docker compose images
# The record directory is created once both refusals above have passed, so a run
# that stops here leaves no record behind. A record with no images file would
# otherwise sort newest and take the place of the last usable one, and a rollback
# reads the newest.
function Save-AethernetVersionRecord([string]$BackupRoot, [string]$EnvPath, [string]$TargetDir) {
	$running = Get-AethernetRunningImageIds
	if ((Invoke-AethernetComposeQuery '--images') -ne 0) {
		Stop-Aethernet "docker compose config --images failed in $TargetDir, so the running version cannot be recorded. Compose printed:`n$(Get-AethernetComposeError '  ')" $AethernetExitPrerequisite
	}
	$refs = @(Get-AethernetComposeImages)
	if ($refs.Count -eq 0) {
		Stop-Aethernet "docker compose config --images returned nothing in $TargetDir, so the running version cannot be recorded. The stack files there declare no service with an image." $AethernetExitPrerequisite
	}
	$Record = New-AethernetRecord $BackupRoot
	Write-AethernetTextFile (Join-Path $Record $AethernetTagFile) @((Get-AethernetEnvValue $EnvPath 'AETHERNET_IMAGE_TAG'))
	$lines = @()
	foreach ($reference in $refs) {
		$id = Get-AethernetRunningImageId $running $reference
		if ($id.Length -eq 0) {
			$id = '-'
		}
		$lines += "$reference $id"
	}
	Write-AethernetTextFile (Join-Path $Record $AethernetImagesFile) $lines
	Write-AethernetLine "Recorded $($lines.Count) image references in $Record."
	return $Record
}

# .env and the stack files go into the record because nothing else regenerates them. .env holds
# every secret the instance was built with, so the record directory is closed to the current
# account alone, and the record belongs wherever the operator already keeps secrets.
function Save-AethernetCurrentFiles([string]$Record, [string]$TargetDir, [string]$EnvPath) {
	$envCopy = Join-Path $Record '.env'
	Copy-Item -LiteralPath $EnvPath -Destination $envCopy -Force
	Set-AethernetPrivateFile $envCopy
	foreach ($name in $AethernetStackFiles) {
		$source = Join-Path $TargetDir (Get-AethernetPlacedName $name)
		$length = Get-AethernetFileLength $source
		if ($length -gt 0) {
			Copy-Item -LiteralPath $source -Destination (Join-Path $Record $name) -Force
		} elseif (Test-Path -LiteralPath $source) {
			Stop-Aethernet "$source is empty, so the record would hold a file a rollback could not use. Put the file back before upgrading." $AethernetExitBackup
		}
	}
}

function Test-AethernetPostgresRunning {
	$result = Invoke-AethernetCapture @('compose', 'ps', '-q', 'postgres')
	if ($result.Code -ne 0 -or $result.Text.Length -eq 0) {
		return $false
	}
	$id = $result.Text.Split("`n")[0].Trim()
	if ($id.Length -eq 0) {
		return $false
	}
	$state = Invoke-AethernetCapture @('inspect', '--format', '{{.State.Status}}', $id)
	return ($state.Code -eq 0 -and $state.Text -eq 'running')
}

function Test-AethernetDumpHeader([string]$Path) {
	$stream = [System.IO.File]::OpenRead($Path)
	try {
		$buffer = New-Object byte[] 5
		if ($stream.Read($buffer, 0, 5) -ne 5) {
			return $false
		}
		return ([System.Text.Encoding]::ASCII.GetString($buffer) -eq 'PGDMP')
	} finally {
		$stream.Dispose()
	}
}

# Step 2 of an upgrade, and the part that gates the rest.
#
# api, worker, users-shard and messages-shard apply schema changes while they start, and starting
# an older image does not undo them. The dump taken before the pull is the only way back across a
# schema change.
#
# By hand:
#   docker compose exec -T postgres pg_dump -U aethernet -d aethernet --format=custom > backups\aethernet.dump
#
# The database and the role are both named aethernet and are fixed in docker-compose.yml. Keep -T.
# Without it Docker attaches a terminal to the command and the dump arrives corrupted, which is
# why the first five bytes are checked against the custom-format magic rather than only the size.
#
# The dump runs against the live stack. pg_dump reads inside one transaction, so it sees a
# consistent database without stopping anything. The volume copy below has no equivalent and is
# why the stack stops there and not here.
#
# The volume copy measures its volume and refuses when the disk is short. This step does not,
# because the size of a custom-format dump is not knowable before pg_dump writes it. Point
# -BackupDir at a drive with room for the database.
# The bundled data stores are services in the stack file. An operator who points the stack at a
# database or an object store outside it takes those services out, and the two backup steps that
# reach into them then have nothing to reach. That is a supported shape rather than a fault, so
# each step says what it skipped and the upgrade goes on. Backing up a store outside the stack
# belongs to whoever runs it.
$script:AethernetStackServices = $null

function Test-AethernetStackDefinesService([string]$Name, [string]$TargetDir) {
	if ($null -eq $script:AethernetStackServices) {
		if ((Invoke-AethernetComposeQuery '--services') -ne 0) {
			Stop-Aethernet "docker compose config --services failed in $TargetDir, so the services this stack defines cannot be read. Compose printed:`n$(Get-AethernetComposeError '  ')" $AethernetExitUnhealthy
		}
		$script:AethernetStackServices = @(Get-AethernetComposeServices)
	}
	return $script:AethernetStackServices -contains $Name
}

function Backup-AethernetDatabase([string]$Record, [string]$TargetDir) {
	if (-not (Test-AethernetStackDefinesService 'postgres' $TargetDir)) {
		Write-AethernetLine 'Skipping the database dump. This stack defines no postgres service, so its database runs outside the stack and only the operator of that database can dump it.'
		return
	}
	if (-not (Test-AethernetPostgresRunning)) {
		Write-AethernetLine 'Postgres is not running. Starting it for the dump.'
		if ((Invoke-AethernetDocker @('compose', 'up', '-d', '--wait', 'postgres')) -ne 0) {
			Stop-Aethernet 'Postgres does not start, so no dump can be taken.' $AethernetExitBackup
		}
	}
	$dump = Join-Path $Record $AethernetDumpFile
	Write-AethernetLine 'Dumping the database.'
	$code = Invoke-AethernetDockerToFile @('compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'aethernet', '-d', 'aethernet', '--format=custom') $dump $TargetDir
	if ($code -ne 0) {
		Remove-AethernetTemporary $dump
		Stop-Aethernet 'pg_dump failed. The instance is untouched.' $AethernetExitBackup
	}
	if (-not (Test-AethernetDumpHeader $dump)) {
		Remove-AethernetTemporary $dump
		Stop-Aethernet 'The dump does not begin with the custom-format header. The instance is untouched.' $AethernetExitBackup
	}
	Write-AethernetLine "Dumped the database to $dump."
}

$script:AethernetVolumeError = ''

function Get-AethernetVolumeError([string]$Indent) {
	if ([string]::IsNullOrWhiteSpace($script:AethernetVolumeError)) {
		return "${Indent}nothing"
	}
	return (($script:AethernetVolumeError -split "`n") | ForEach-Object {"$Indent$_"}) -join "`n"
}

function Get-AethernetVolumeSizeKb([string]$Volume) {
	$result = Invoke-AethernetCapture @('run', '--rm', '-v', "${Volume}:/data:ro", $AethernetHelperImage, 'du', '-sk', '/data')
	$script:AethernetVolumeError = $result.Error
	if ($result.Code -ne 0) {
		return -1
	}
	$first = $result.Text.Split("`n")[0].Trim()
	if ($first -match '^(\d+)') {
		return [long]$Matches[1]
	}
	return -1
}

function Get-AethernetFreeKb([string]$Path) {
	$root = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path))
	$drive = New-Object System.IO.DriveInfo($root)
	return [long]($drive.AvailableFreeSpace / 1024)
}

# Step 2 continued: the volume copy.
#
# A live copy can catch a file mid-write, so the stack stops for it. The stack comes back up on
# the images it was already running before anything else happens, so a failure here leaves a
# working instance rather than a stopped one.
#
# By hand:
#   docker compose stop
#   docker run --rm -v aethernet_seaweedfs-data:/data -v "${PWD}\backups:/backup" alpine tar czf /backup/seaweedfs-data.tgz -C /data .
#   docker compose up -d
function Copy-AethernetVolumes([string]$Record, [string]$Project, [string]$TargetDir) {
	if (-not (Test-AethernetStackDefinesService 'seaweedfs' $TargetDir)) {
		Write-AethernetLine 'Skipping the uploads copy. This stack defines no seaweedfs service, so its objects live outside the stack and only the operator of that store can copy them.'
		return
	}
	$present = @()
	foreach ($volume in $AethernetBackupVolumes) {
		$full = "${Project}_$volume"
		$inspect = Invoke-AethernetCapture @('volume', 'inspect', $full)
		if ($inspect.Code -ne 0) {
			Stop-Aethernet "The volume $full does not exist, so the uploads cannot be copied. The stack declares that volume, so this is a project name other than $Project or a volume that was removed. Pass -NoVolumeBackup to take the database dump alone when the uploads of this instance live somewhere this script cannot reach." $AethernetExitBackup
		}
		$size = Get-AethernetVolumeSizeKb $full
		if ($size -lt 0) {
			Stop-Aethernet "Cannot measure the volume $full, so the uploads copy cannot be sized. Pass -NoVolumeBackup to take the database dump alone. Docker printed:`n$(Get-AethernetVolumeError '  ')" $AethernetExitBackup
		}
		$free = Get-AethernetFreeKb $Record
		$need = [long]($size * $AethernetVolumeHeadroomPercent / 100)
		if ($free -lt $need) {
			Stop-Aethernet "$full holds $([long]($size / 1024)) MB and $Record has $([long]($free / 1024)) MB free. Point -BackupDir at a drive with room, or pass -NoVolumeBackup to take the database dump alone." $AethernetExitBackup
		}
		$present += $volume
	}
	if ($present.Count -eq 0) {
		return
	}
	Write-AethernetLine 'Stopping the stack for a consistent copy of the uploads.'
	if ((Invoke-AethernetDocker @('compose', 'stop')) -ne 0) {
		Stop-Aethernet 'docker compose stop failed.' $AethernetExitBackup
	}
	foreach ($volume in $present) {
		$full = "${Project}_$volume"
		Write-AethernetLine "Copying $full."
		$code = Invoke-AethernetDocker @('run', '--rm', '-v', "${full}:/data:ro", '-v', "${Record}:/backup", $AethernetHelperImage, 'tar', 'czf', "/backup/$volume.tgz", '-C', '/data', '.')
		if ($code -ne 0) {
			[void](Invoke-AethernetDocker @('compose', 'up', '-d', '--remove-orphans'))
			Stop-Aethernet "Copying $full failed. The stack is started again on the images it was running." $AethernetExitBackup
		}
	}
	Write-AethernetLine 'Starting the stack again before the upgrade continues.'
	if ((Invoke-AethernetDocker @('compose', 'up', '-d', '--remove-orphans')) -ne 0) {
		Stop-Aethernet 'docker compose up -d failed after the copy. Read docker compose logs.' $AethernetExitBackup
	}
}

function Backup-AethernetInstance([string]$Record, [string]$TargetDir, [string]$Project) {
	if ($SkipBackupAcceptDataLoss) {
		Write-AethernetLine 'Skipping the backup. -SkipBackupAcceptDataLoss was given, so a schema change has no way back.'
		return
	}
	Backup-AethernetDatabase $Record $TargetDir
	if ($NoVolumeBackup) {
		Write-AethernetLine 'Skipping the uploads copy. -NoVolumeBackup was given.'
		return
	}
	Copy-AethernetVolumes $Record $Project $TargetDir
}

# A newer Postgres major does not read the data directory an older major wrote, so moving between
# majors means dumping, removing the volume that holds the database, and restoring into an empty
# directory. Removing that volume is the one destructive act in the whole procedure, and it is not
# something a script should do on an operator's behalf while they read scrolling output.
#
# The refreshed file is still staged when this runs, so a refusal here leaves the instance exactly
# as it was.
function Assert-AethernetPostgresMajor([string]$TargetDir, [string]$StagingDir) {
	$old = Get-AethernetPostgresMajor (Join-Path $TargetDir $script:AethernetComposeBase)
	$new = Get-AethernetPostgresMajor (Join-Path $StagingDir 'docker-compose.yml')
	if ($old.Length -eq 0 -or $new.Length -eq 0 -or $old -eq $new) {
		return
	}
	Stop-Aethernet "The refreshed docker-compose.yml pins postgres:$new and this instance runs postgres:$old. A major version change goes through a dump, an empty data directory and a restore, which this script does not do because it destroys the volume holding the database. Nothing was changed. The procedure is at https://aethernet.dev/operator/upgrading/" $AethernetExitRefused
}

# Puts one line of .env back, and proves it touched nothing else.
#
# AETHERNET_IMAGE_TAG is the only key this function writes. Every other line, which is every
# secret, is compared before the new file replaces the old one, so a rewrite that lost or changed
# a secret cannot land.
function Set-AethernetImageTag([string]$EnvPath, [string]$Tag) {
	$before = Get-AethernetEnvLines $EnvPath
	$found = $false
	$after = @()
	foreach ($line in $before) {
		if ($line.StartsWith('AETHERNET_IMAGE_TAG=')) {
			$after += "AETHERNET_IMAGE_TAG=$Tag"
			$found = $true
		} else {
			$after += $line
		}
	}
	if (-not $found) {
		Stop-Aethernet "$EnvPath declares no AETHERNET_IMAGE_TAG, so the tag cannot be put back. Set it by hand." $AethernetExitRefused
	}
	$keptBefore = @($before | Where-Object {-not $_.StartsWith('AETHERNET_IMAGE_TAG=')})
	$keptAfter = @($after | Where-Object {-not $_.StartsWith('AETHERNET_IMAGE_TAG=')})
	if ($keptBefore.Count -eq 0 -or ($keptBefore -join "`n") -ne ($keptAfter -join "`n")) {
		Stop-Aethernet 'Rewriting AETHERNET_IMAGE_TAG would have changed another line in .env. Nothing was written.' $AethernetExitRefused
	}
	Write-AethernetEnvFile $EnvPath $after
	Write-AethernetLine "AETHERNET_IMAGE_TAG in .env is $Tag."
}

function Show-AethernetUpdatePlan([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot) {
	Write-AethernetLine 'Plan: upgrade'
	Write-AethernetLine "  Directory:  $TargetDir"
	Write-AethernetLine "  Ref:        $Ref"
	Write-AethernetLine "  Image tag:  $(Get-AethernetEnvValue $EnvPath 'AETHERNET_IMAGE_TAG') from .env"
	Write-AethernetLine "  Backup dir: $BackupRoot"
	$missing = Get-AethernetMissingRequiredSecrets $EnvPath
	if ($missing.Count -gt 0) {
		Write-AethernetLine '  Writes .env: the run mints these before it reads anything, because the refreshed stack requires them'
		foreach ($name in $missing) {
			Write-AethernetLine "              $name"
		}
	}
	$running = Get-AethernetRunningImageIds
	if ((Invoke-AethernetComposeQuery '--images') -ne 0) {
		Write-AethernetLine '  Refusal:    docker compose config --images fails here, and step 1 of the upgrade reads that list'
		Write-AethernetLine '  Compose said:'
		Write-AethernetLine (Get-AethernetComposeError '    ')
		if ($missing.Count -gt 0) {
			Write-AethernetLine '  Outcome:    the run writes the keys above first, which may be what Compose is missing, so this refusal may not stand'
		} else {
			Write-AethernetLine '  Outcome:    the run stops on step 1 and changes nothing'
		}
		Write-AethernetPlanFooter $missing
		return
	}
	Write-AethernetLine '  Running now:'
	foreach ($reference in Get-AethernetComposeImages) {
		$id = Get-AethernetRunningImageId $running $reference
		if ($id.Length -eq 0) {
			$id = 'no container runs this image'
		}
		Write-AethernetLine "    $reference $id"
	}
	if ($SkipBackupAcceptDataLoss) {
		Write-AethernetLine '  Backup:     none, and a schema change would have no way back'
	} elseif ($NoVolumeBackup) {
		Write-AethernetLine '  Backup:     the database dump, .env, and the stack files'
	} else {
		Write-AethernetLine '  Backup:     the database dump, the uploads volume, .env, and the stack files'
		Write-AethernetLine '  Downtime:   the stack stops for the uploads copy, then again for the recreate'
	}
	# The dry run downloads into a temporary directory so it can name the files that actually
	# change, the services that actually restart, and a Postgres major that would stop the run. It
	# removes that directory before it returns and touches nothing in the working directory.
	$staging = New-AethernetStagingDirectory ([System.IO.Path]::GetTempPath())
	try {
		Get-AethernetStackFiles $staging $Ref
		Write-AethernetLine '  File changes:'
		$changed = 0
		foreach ($name in $AethernetStackFiles) {
			$placed = Get-AethernetPlacedName $name
			$current = Join-Path $TargetDir $placed
			if (-not (Test-Path -LiteralPath $current)) {
				Write-AethernetLine "    $placed is new"
				$changed++
			} elseif (Test-AethernetSameFile $current (Join-Path $staging $name)) {
				Write-AethernetLine "    $placed is unchanged"
			} else {
				Write-AethernetLine "    $placed changes"
				$changed++
			}
		}
		if ($changed -eq 0) {
			Write-AethernetLine "  Note:       ref $Ref moves no stack file"
		}
		$old = Get-AethernetPostgresMajor (Join-Path $TargetDir $script:AethernetComposeBase)
		$new = Get-AethernetPostgresMajor (Join-Path $staging 'docker-compose.yml')
		if ($old.Length -gt 0 -and $new.Length -gt 0 -and $old -ne $new) {
			Write-AethernetLine "  Refusal:    postgres moves from $old to $new, which this script does not do"
			Write-AethernetLine '  Outcome:    the run stops at that refusal and changes nothing'
			Write-AethernetPlanFooter $missing
			return
		}
		foreach ($entry in Get-AethernetChangedMounts $TargetDir $staging) {
			Write-AethernetLine "  Restart:    $($entry.Service), because $($entry.Name) changes and a mounted file survives up -d"
		}
	} finally {
		Remove-AethernetStagingDirectory $staging
	}
	Write-AethernetLine '  Commands:   docker compose pull, docker compose up -d'
	Write-AethernetPlanFooter $missing
	Write-AethernetLine 'Drop -DryRun to run this.'
}

function Show-AethernetRollbackPlan([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot) {
	$record = Get-AethernetNewestRecord $BackupRoot
	if ($record.Length -eq 0) {
		Stop-Aethernet "No record in $BackupRoot. A rollback needs an upgrade that recorded what was running." $AethernetExitPrerequisite
	}
	$recordedTag = Get-AethernetRecordTag $record
	$currentTag = Get-AethernetEnvValue $EnvPath 'AETHERNET_IMAGE_TAG'
	Write-AethernetLine 'Plan: rollback'
	Write-AethernetLine "  Directory:  $TargetDir"
	Write-AethernetLine "  Record:     $record"
	if ($recordedTag -eq $currentTag) {
		Write-AethernetLine "  Image tag:  stays $currentTag, so the recorded image IDs move back onto it"
	} else {
		Write-AethernetLine "  Image tag:  $currentTag becomes $recordedTag in .env"
	}
	Write-AethernetLine '  Images:'
	foreach ($line in Get-Content -LiteralPath (Join-Path $record $AethernetImagesFile)) {
		$parts = $line.Trim().Split(' ')
		if ($parts.Count -lt 2) {
			continue
		}
		if ($parts[1] -eq '-') {
			Write-AethernetLine "    $($parts[0]) was not recorded with an ID"
		} elseif ((Get-AethernetImageId $parts[1]).Length -gt 0) {
			Write-AethernetLine "    $($parts[0]) back to $($parts[1])"
		} else {
			Write-AethernetLine "    $($parts[0]) is gone from this host, so $($parts[1]) cannot come back"
		}
	}
	Write-AethernetLine "  Files:      restored from $record"
	Write-AethernetLine '  Database:   stays where the new release left it'
	Write-AethernetLine 'Nothing is written. Drop -DryRun to run this.'
}

# The full upgrade, in the order that leaves a working instance behind at every point it can fail.
function Invoke-AethernetUpgrade([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot, [string]$Project) {
	Add-AethernetRequiredSecrets $EnvPath
	$record = Save-AethernetVersionRecord $BackupRoot $EnvPath $TargetDir
	Save-AethernetCurrentFiles $record $TargetDir $EnvPath
	Backup-AethernetInstance $record $TargetDir $Project

	$staging = New-AethernetStagingDirectory $TargetDir
	$changedMounts = @()
	try {
		Get-AethernetStackFiles $staging $Ref
		Assert-AethernetPostgresMajor $TargetDir $staging
		$changedMounts = Get-AethernetChangedMounts $TargetDir $staging
		Move-AethernetStackFiles $staging $TargetDir
	} finally {
		Remove-AethernetStagingDirectory $staging
	}
	Write-AethernetLine "Stack files in $TargetDir are at ref $Ref."

	# The pull runs while the old containers still serve, so the long part of an upgrade costs no
	# downtime.
	#
	# By hand:
	#   docker compose pull
	Write-AethernetLine 'Pulling images.'
	if ((Invoke-AethernetDocker @('compose', 'pull')) -ne 0) {
		Stop-Aethernet 'docker compose pull failed. The stack files are refreshed and the instance still runs the old images.' $AethernetExitDownload
	}
	# Recreates the containers whose image or configuration changed and leaves the rest running.
	#
	# By hand:
	#   docker compose up -d --remove-orphans
	#
	# Behind your own reverse proxy every command names the overlay, which COMPOSE_FILE in .env
	# does once. An invocation without it recreates the edge from the base file, which binds 80 and
	# 443 and requests its own certificate.
	#
	# api, worker, users-shard and messages-shard each apply the database schema while they start,
	# so the upgrade is not finished until all four are back up. All four take the same Postgres
	# advisory lock around that work, so several of them starting at once is safe.
	#
	# app-proxy waits for api to report healthy and the edge waits for the Gateway, so the hostname
	# returns errors for a minute or two after this call. The api healthcheck allows 90 seconds
	# before it counts a failure.
	Write-AethernetLine 'Recreating the stack.'
	if ((Invoke-AethernetDocker @('compose', 'up', '-d', '--remove-orphans')) -ne 0) {
		Stop-Aethernet 'docker compose up -d failed. Read docker compose logs.' $AethernetExitUnhealthy
	}
	Restart-AethernetMounts $changedMounts $TargetDir
	Wait-AethernetStack 'Waiting for every service to report ready.'
	$originValue = Get-AethernetPublicOrigin $EnvPath
	if ($originValue.Length -gt 0) {
		Test-AethernetPublicHealth $originValue
	}
	Write-AethernetLine "Instance upgraded in $TargetDir."
	Write-AethernetLine "The record of what it ran before is in $record."
	Write-AethernetLine "Go back with install.ps1 -Rollback -Dir $TargetDir."
	exit 0
}

# A rollback moves the images and the stack files back. The database stays where the new release
# left it, because api, worker, users-shard and messages-shard apply schema work in place while
# they start and an older image does not undo it. Across a release that changed the schema, the
# dump in the record is the only way back, and putting it back is a separate decision an operator
# makes.
#
# Two shapes, depending on what the upgrade moved:
#
#   A pinned tag moved, so the old images still carry their own tag. The tag goes back into .env
#   and Compose finds them.
#
#     By hand: set AETHERNET_IMAGE_TAG back, then docker compose up -d
#
#   A moving tag such as v1 stayed put and the images under it changed. The recorded image IDs are
#   still on the host until a prune removes them, so the old ID goes back onto the tag it had.
#
#     By hand: docker image tag <recorded id> ghcr.io/aethernetapp/aethernet-api:v1
#
# Neither shape pulls. A pull is what moved the instance forward in the first place, and running
# one here would undo the rollback in the same breath.
function Invoke-AethernetRollback([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot) {
	$record = Get-AethernetNewestRecord $BackupRoot
	if ($record.Length -eq 0) {
		Stop-Aethernet "No record in $BackupRoot. A rollback needs an upgrade that recorded what was running." $AethernetExitPrerequisite
	}
	$imagesPath = Join-Path $record $AethernetImagesFile
	if (-not (Test-Path -LiteralPath $imagesPath)) {
		Stop-Aethernet "$record records no images." $AethernetExitPrerequisite
	}
	Write-AethernetLine "Rolling back to $record."

	$recordedTag = Get-AethernetRecordTag $record
	$currentTag = Get-AethernetEnvValue $EnvPath 'AETHERNET_IMAGE_TAG'
	$moved = $false
	if ($recordedTag.Length -gt 0 -and $recordedTag -ne $currentTag) {
		if ($recordedTag -match '[\s/]') {
			Stop-Aethernet "The recorded image tag $recordedTag is not an image tag." $AethernetExitRefused
		}
		Set-AethernetImageTag $EnvPath $recordedTag
		$moved = $true
	} else {
		foreach ($line in Get-Content -LiteralPath $imagesPath) {
			$parts = $line.Trim().Split(' ')
			if ($parts.Count -lt 2 -or $parts[1] -eq '-') {
				continue
			}
			if ((Get-AethernetImageId $parts[1]).Length -eq 0) {
				Write-AethernetLine "$($parts[0]) is gone from this host, so it keeps the image it has now."
				continue
			}
			if ((Invoke-AethernetDocker @('image', 'tag', $parts[1], $parts[0])) -ne 0) {
				Stop-Aethernet "Cannot put $($parts[1]) back on $($parts[0])." $AethernetExitRefused
			}
			$moved = $true
		}
	}
	if (-not $moved) {
		Stop-Aethernet "Nothing in $record can be put back. The recorded tag is the one in .env and every recorded image has been removed from this host, which a docker image prune does." $AethernetExitPrerequisite
	}

	foreach ($name in $AethernetStackFiles) {
		$source = Join-Path $record $name
		$length = Get-AethernetFileLength $source
		if ($length -gt 0) {
			Copy-Item -LiteralPath $source -Destination (Join-Path $TargetDir (Get-AethernetPlacedName $name)) -Force
		} elseif (Test-Path -LiteralPath $source) {
			Stop-Aethernet "$source is empty, so restoring it would replace a working file with nothing. Nothing was restored. Take the file from another record or from the ref the record names." $AethernetExitRefused
		}
	}
	Write-AethernetLine "Stack files in $TargetDir are the ones the record holds."

	Write-AethernetLine 'Recreating the stack.'
	if ((Invoke-AethernetDocker @('compose', 'up', '-d', '--remove-orphans')) -ne 0) {
		Stop-Aethernet 'docker compose up -d failed. Read docker compose logs.' $AethernetExitUnhealthy
	}
	# The mounted file came back from the record, so its service restarts. Comparing it first
	# would save one restart and cost the reader a reason.
	Restart-AethernetMounts $AethernetMountedFiles $TargetDir
	Wait-AethernetStack 'Waiting for every service to report ready.'
	$originValue = Get-AethernetPublicOrigin $EnvPath
	if ($originValue.Length -gt 0) {
		Test-AethernetPublicHealth $originValue
	}
	Write-AethernetLine "Instance rolled back in $TargetDir."
	$dumpPath = Join-Path $record $AethernetDumpFile
	if ((Test-Path -LiteralPath $dumpPath) -and ((Get-Item -LiteralPath $dumpPath).Length -gt 0)) {
		Write-AethernetLine "The database did not move. Restore it from $dumpPath only when the release you left changed the schema."
	} else {
		Write-AethernetLine 'The database did not move. That record holds no dump, because the upgrade ran with -SkipBackupAcceptDataLoss, so a release that changed the schema has no way back.'
	}
	exit 0
}

function Assert-AethernetInstance([string]$TargetDir, [string]$EnvPath) {
	if (-not (Test-Path -LiteralPath $EnvPath)) {
		Stop-Aethernet "No .env in $TargetDir. That directory holds no instance. Run install.ps1 with neither -Update nor -Rollback to set one up." $AethernetExitPrerequisite
	}
	Resolve-AethernetComposeBase $TargetDir $EnvPath
	$compose = Join-Path $TargetDir $script:AethernetComposeBase
	if (-not (Test-Path -LiteralPath $compose)) {
		if ($script:AethernetComposeBaseFrom.Length -gt 0) {
			Stop-Aethernet "$($script:AethernetComposeBaseFrom) names $($script:AethernetComposeBase) first, and $compose is not there. Put that file back, or name the file the instance runs on first in COMPOSE_FILE." $AethernetExitPrerequisite
		}
		Stop-Aethernet "No compose file in $TargetDir. Compose looks for compose.yaml, compose.yml, docker-compose.yml and docker-compose.yaml there, and that directory holds none of them, so it does not hold an instance." $AethernetExitPrerequisite
	}
	if ((Get-AethernetFileLength $compose) -eq 0) {
		Stop-Aethernet "$compose is empty. A redirect that captured a failed download leaves that, and Compose refuses an empty compose file. Put the file back from a backup or from the record of the last upgrade, then run this again." $AethernetExitPrerequisite
	}
	if ($script:AethernetComposeBase -ne 'docker-compose.yml') {
		Write-AethernetLine "Compose loads $($script:AethernetComposeBase) in $TargetDir, so the stack's docker-compose.yml is written to that name."
	}
}

# Compose reads COMPOSE_FILE from .env and loads every file it names before it answers anything, so
# one file the directory does not hold fails every docker compose command run in it. What Compose
# prints for that is a single stat line that names neither COMPOSE_FILE nor .env.
#
# Two of the files this script downloads sit in .env.example as a COMPOSE_FILE line to uncomment,
# so an instance set up before this script existed can hold the line and not the file. An upgrade
# reads the running images before it refreshes the stack files, so such an instance stops on the
# first step and no re-run gets any further.
#
# The line stays. Without the file it names the edge container binds 80 and 443 and requests its
# own certificate.
#
# By hand:
#   Select-String COMPOSE_FILE .env
# A value as Compose reads it: no surrounding quotes and no trailing blanks.
# Get-AethernetEnvLines already drops a carriage return. Reading it any other way
# invents a filename the operator cannot see and refuses a run that would have
# worked.
function Get-AethernetEnvScalar([string]$EnvPath, [string]$Name) {
	$raw = (Get-AethernetEnvValue $EnvPath $Name).TrimEnd()
	if ($raw.Length -ge 2) {
		if (($raw[0] -eq '"' -and $raw[-1] -eq '"') -or ($raw[0] -eq "'" -and $raw[-1] -eq "'")) {
			return $raw.Substring(1, $raw.Length - 2)
		}
	}
	return $raw
}

function Get-AethernetComposeSetting([string]$EnvPath) {
	$value = ''
	$source = 'the environment'
	if ($null -ne $env:COMPOSE_FILE) {
		$value = [string]$env:COMPOSE_FILE
	}
	if ($value.Length -eq 0) {
		$value = Get-AethernetEnvScalar $EnvPath 'COMPOSE_FILE'
		$source = $EnvPath
	}
	$separator = ''
	if ($null -ne $env:COMPOSE_PATH_SEPARATOR) {
		$separator = [string]$env:COMPOSE_PATH_SEPARATOR
	}
	if ($separator.Length -eq 0) {
		$separator = Get-AethernetEnvScalar $EnvPath 'COMPOSE_PATH_SEPARATOR'
	}
	if ($separator.Length -eq 0) {
		$separator = [System.IO.Path]::PathSeparator
	}
	return [pscustomobject]@{Value = $value; Source = $source; Separator = $separator}
}

function Resolve-AethernetComposeBase([string]$TargetDir, [string]$EnvPath) {
	$setting = Get-AethernetComposeSetting $EnvPath
	$script:AethernetComposeBaseFrom = ''
	foreach ($name in $setting.Value.Split([string[]]$setting.Separator, [System.StringSplitOptions]::None)) {
		if ($name.Length -eq 0) {
			continue
		}
		$base = $name
		foreach ($prefix in @('./', '.\')) {
			if ($base.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
				$base = $base.Substring($prefix.Length)
			}
		}
		foreach ($root in @("$TargetDir/", "$TargetDir\")) {
			if ($base.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
				$base = $base.Substring($root.Length)
			}
		}
		$script:AethernetComposeBaseFrom = "COMPOSE_FILE from $($setting.Source)"
		if ($base.Contains('/') -or $base.Contains('\')) {
			Stop-Aethernet "$($script:AethernetComposeBaseFrom) names $name first, and that file is not directly in $TargetDir. This script refreshes only the files in the directory it acts on, so the upgrade would leave the file Compose loads on the old stack. Move it into $TargetDir and name it there, or upgrade by hand." $AethernetExitPrerequisite
		}
		$script:AethernetComposeBase = $base
		return
	}
	$found = Get-AethernetComposeNameIn $TargetDir
	if ($found.Length -gt 0) {
		$script:AethernetComposeBase = $found
	} else {
		$script:AethernetComposeBase = 'docker-compose.yml'
	}
}

function Assert-AethernetComposeFiles([string]$TargetDir, [string]$EnvPath) {
	$setting = Get-AethernetComposeSetting $EnvPath
	$value = $setting.Value
	$source = $setting.Source
	$separator = $setting.Separator
	if ($value.Length -eq 0) {
		return
	}
	foreach ($name in $value.Split([string[]]$separator, [System.StringSplitOptions]::None)) {
		if ($name.Length -eq 0) {
			continue
		}
		$path = $name
		if (-not [System.IO.Path]::IsPathRooted($path)) {
			$path = Join-Path $TargetDir $name
		}
		if (Test-Path -LiteralPath $path) {
			continue
		}
		if ($AethernetStackFiles -contains $name) {
			Stop-Aethernet "COMPOSE_FILE from $source names $name and $path is not there, so every docker compose command in $TargetDir fails and this run stops before it changes anything. This script downloads $name, and an instance set up before it existed does not hold that file yet. Put it in place and run this again:`n  Invoke-WebRequest -Uri $AethernetRawBase/$Ref/$AethernetStackPath/$name -OutFile $path -UseBasicParsing`nLeave the COMPOSE_FILE line as it is. Without $name the edge container binds 80 and 443 and requests its own certificate." $AethernetExitPrerequisite
		}
		Stop-Aethernet "COMPOSE_FILE from $source names $name and $path is not there, so every docker compose command in $TargetDir fails. This script does not download $name. Put that file back, or take it out of the COMPOSE_FILE line." $AethernetExitPrerequisite
	}
}

function Invoke-AethernetInstall {
	if ($Help) {
		Show-AethernetUsage
		exit 0
	}
	if ($Rest.Count -gt 0) {
		Write-AethernetProblem "Unknown argument: $($Rest[0])"
		Show-AethernetUsage
		exit $AethernetExitUsage
	}
	if ($Tls -ne 'bundled' -and $Tls -ne 'proxy') {
		Stop-Aethernet "-Tls takes bundled or proxy. Got: $Tls" $AethernetExitUsage
	}
	Assert-AethernetRef $Ref
	Assert-AethernetEdgeBind $EdgeBind
	if ($ImageTag.Length -eq 0) {
		Stop-Aethernet '-ImageTag must not be empty.' $AethernetExitUsage
	}
	if ($Update -and $Rollback) {
		Stop-Aethernet '-Update and -Rollback do not combine.' $AethernetExitUsage
	}
	if ($NoStart -and ($Update -or $Rollback)) {
		Stop-Aethernet '-NoStart belongs to an install. An upgrade that does not recreate is not an upgrade.' $AethernetExitUsage
	}
	if ($SkipBackupAcceptDataLoss -and -not $Update) {
		Stop-Aethernet '-SkipBackupAcceptDataLoss belongs to -Update.' $AethernetExitUsage
	}
	if ($NoVolumeBackup -and -not $Update) {
		Stop-Aethernet '-NoVolumeBackup belongs to -Update.' $AethernetExitUsage
	}
	if ($SkipBackupAcceptDataLoss -and $NoVolumeBackup) {
		Stop-Aethernet '-SkipBackupAcceptDataLoss already skips the volume copy.' $AethernetExitUsage
	}

	Invoke-AethernetPreflight

	$targetPath = $Dir
	$adoptedCwd = $false
	$fellBack = $false
	if ($targetPath.Length -eq 0) {
		$here = (Get-Location).Path
		$hereEnv = Join-Path $here '.env'
		$hereIsAethernet = (Test-Path -LiteralPath $hereEnv) -and (@(Get-AethernetEnvLines $hereEnv | Where-Object {$_.StartsWith('AETHERNET_')}).Count -gt 0)
		$hereCompose = Get-AethernetComposeNameIn $here
		if (($Update -or $Rollback) -and $hereCompose.Length -gt 0 -and (Get-AethernetFileLength (Join-Path $here $hereCompose)) -gt 0 -and $hereIsAethernet) {
			$targetPath = $here
			$adoptedCwd = $true
		} else {
			$targetPath = Join-Path $HOME 'aethernet'
			$fellBack = $Update -or $Rollback
		}
	}
	$targetDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($targetPath)
	$envPath = Join-Path $targetDir '.env'
	$backupPath = $BackupDir
	if ($backupPath.Length -eq 0) {
		$backupPath = Join-Path $targetDir 'backups'
	}
	$backupRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($backupPath)
	if ($adoptedCwd) {
		Write-AethernetLine "Acting on the instance in $targetDir, the working directory. Pass -Dir to name another."
	}
	if ($fellBack) {
		Write-AethernetLine "The working directory holds no instance, so this acts on $targetDir. Pass -Dir to name another."
	}

	if ($Update -or $Rollback) {
		Assert-AethernetInstance $targetDir $envPath
		if ($Ref.Length -eq 0) {
			$script:Ref = Get-AethernetRefForTag (Get-AethernetEnvValue $envPath 'AETHERNET_IMAGE_TAG')
			Assert-AethernetDerivedRef $Ref $envPath
		}
		Assert-AethernetComposeFiles $targetDir $envPath
		$project = Get-AethernetComposeProject $targetDir
		if ($project.Length -eq 0) {
			Stop-Aethernet "$($script:AethernetComposeBase) in $targetDir declares no project name, so the volume names cannot be derived." $AethernetExitPrerequisite
		}
		Push-Location -LiteralPath $targetDir
		try {
			if ($DryRun) {
				if ($Rollback) {
					Show-AethernetRollbackPlan $targetDir $envPath $backupRoot
				} else {
					Show-AethernetUpdatePlan $targetDir $envPath $backupRoot
				}
				exit 0
			}
			if ($Rollback) {
				Invoke-AethernetRollback $targetDir $envPath $backupRoot
			}
			Invoke-AethernetUpgrade $targetDir $envPath $backupRoot $project
		} finally {
			Pop-Location
		}
		return
	}

	$allowPrompt = $true
	if ($NonInteractive) {
		$allowPrompt = $false
	}
	if ($DryRun) {
		$allowPrompt = $false
	}
	if ([Console]::IsInputRedirected) {
		$allowPrompt = $false
	}

	$domainValue = Resolve-AethernetValue $Domain 'Hostname the instance answers on' '-Domain' $allowPrompt
	$emailValue = Resolve-AethernetValue $Email 'Address to write as AETHERNET_VAPID_EMAIL' '-Email' $allowPrompt
	Assert-AethernetDomain $domainValue
	Assert-AethernetEmail $emailValue

	if ($Ref.Length -eq 0) {
		$script:Ref = Get-AethernetRefForTag $ImageTag
		Assert-AethernetDerivedRef $Ref $envPath
	}

	if ($DryRun) {
		Write-AethernetLine 'Plan:'
		Write-AethernetLine "  Directory:  $targetDir"
		Write-AethernetLine "  Ref:        $Ref"
		Write-AethernetLine "  Image tag:  $ImageTag"
		Write-AethernetLine "  TLS mode:   $Tls"
		if ($Tls -eq 'proxy') {
			Write-AethernetLine "  Edge bind:  $EdgeBind"
		}
		Write-AethernetLine "  Domain:     $domainValue"
		Write-AethernetLine "  Email:      $emailValue"
		Write-AethernetLine "  Files:      $($AethernetStackFiles -join ', ')"
		Write-AethernetLine "  Secrets:    $($AethernetSecretKeys.Count) generated into .env"
		Write-AethernetLine 'Nothing was written.'
		exit 0
	}

	if (-not (Test-Path -LiteralPath $targetDir)) {
		New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
	}
	if (Test-Path -LiteralPath $envPath) {
		Stop-Aethernet "$envPath already exists. Run this script with -Update to upgrade the instance and keep every secret." $AethernetExitRefused
	}

	$staging = New-AethernetStagingDirectory $targetDir
	try {
		Get-AethernetStackFiles $staging $Ref
		Move-AethernetStackFiles $staging $targetDir
	} finally {
		Remove-AethernetStagingDirectory $staging
	}

	Push-Location -LiteralPath $targetDir
	try {
		$vapid = New-AethernetVapidPair
		$lines = @()
		foreach ($entry in $AethernetNonSecretKeys) {
			$value = ''
			if ($entry.Kind -eq 'literal') {
				$value = $entry.Value
			} elseif ($entry.Kind -eq 'domain') {
				$value = $domainValue
			} elseif ($entry.Kind -eq 'email') {
				$value = $emailValue
			} elseif ($entry.Kind -eq 'image_tag') {
				$value = $ImageTag
			} else {
				Stop-Aethernet "Unknown source for $($entry.Name)." $AethernetExitUsage
			}
			$lines += "$($entry.Name)=$value"
		}
		if ($Tls -eq 'proxy') {
			$lines += 'COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml'
			$lines += "AETHERNET_EDGE_BIND=$EdgeBind"
		}
		foreach ($entry in $AethernetSecretKeys) {
			$value = ''
			if ($entry.Kind -eq 'hex') {
				$value = ConvertTo-AethernetHex (New-AethernetRandomBytes 32)
			} elseif ($entry.Kind -eq 'base64') {
				$value = [System.Convert]::ToBase64String((New-AethernetRandomBytes 32))
			} elseif ($entry.Kind -eq 'vapid_public') {
				$value = $vapid.Public
			} elseif ($entry.Kind -eq 'vapid_private') {
				$value = $vapid.Private
			} else {
				Stop-Aethernet "Unknown generator for $($entry.Name)." $AethernetExitSecret
			}
			$lines += "$($entry.Name)=$value"
		}
		Write-AethernetEnvFile $envPath $lines
		Write-AethernetLine "Wrote $envPath with $($lines.Count) values, readable by the current account only."

		if ($NoStart) {
			Write-AethernetLine "Run docker compose up -d in $targetDir to start the instance."
			Write-AethernetLine "Secrets live in $envPath. Back that file up."
			exit 0
		}

		if ((Invoke-AethernetDocker @('compose', 'up', '-d')) -ne 0) {
			Stop-Aethernet 'docker compose up -d failed.' $AethernetExitUnhealthy
		}
		Wait-AethernetStack 'Waiting for the stack to report healthy. The first start pulls images and takes several minutes.'
		$readyOrigin = Get-AethernetPublicOrigin $envPath
		if ($readyOrigin.Length -eq 0) {
			$readyOrigin = "https://$domainValue"
		}
		Test-AethernetPublicHealth $readyOrigin
		Write-AethernetLine "Instance ready at $readyOrigin"
		Write-AethernetLine 'Open it and create the first admin account. Finish the setup wizard in the same sitting.'
		Write-AethernetLine "Secrets live in $envPath. Back that file up."
	} finally {
		Pop-Location
	}
}

try {
	Invoke-AethernetInstall
} catch [System.Management.Automation.PipelineStoppedException] {
	Write-AethernetProblem 'Interrupted.'
	exit $AethernetExitInterrupted
}
