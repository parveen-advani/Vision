param(
    [switch]$NoBrowser,
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$projectRoot = Join-Path $PSScriptRoot 'classroom-vision-ai'
$runDirectory = Join-Path $PSScriptRoot '.local-run'
$statePath = Join-Path $runDirectory 'vision-services.json'
$backendPython = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
$viteScript = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$serviceState = @{}

trap {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

if (Test-Path -LiteralPath $statePath) {
    $savedState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($savedState.projectRoot -eq $projectRoot) {
        foreach ($service in @('frontend', 'backend')) {
            $serviceState[$service] = $savedState.$service
        }
    }
}

function Get-ServicePort([string]$Service) {
    if ($Service -eq 'frontend') { return 5173 }
    return 8000
}

function Get-Listener([string]$Service) {
    $port = Get-ServicePort $Service
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if (-not $listeners.Count) { return $null }
    $owners = @($listeners.OwningProcess | Select-Object -Unique)
    if ($owners.Count -ne 1 -or @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count) {
        throw "Port $port is occupied by another service or a non-loopback listener. No process was stopped."
    }
    return Get-CimInstance Win32_Process -Filter "ProcessId = $($owners[0])"
}

function Test-OwnedProcess([string]$Service, $Process) {
    if (-not $Process -or -not $Process.CommandLine) { return $false }
    $command = $Process.CommandLine.Replace('/', '\')
    if ($Service -eq 'backend') {
        return $command.IndexOf($backendPython, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            $command -match '\s-m\s+uvicorn\s+app\.main:app(?:\s|$)'
    }
    if ($command.IndexOf($viteScript, [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }

    # Also recognize this session's recorded Vite process, which was started
    # with a relative script path. Creation time prevents reuse of an old PID.
    $record = $serviceState[$Service]
    return $record -and $record.pid -eq $Process.ProcessId -and
        $record.createdAt -eq $Process.CreationDate.ToUniversalTime().ToString('o') -and
        $record.commandLine -ceq $Process.CommandLine -and
        $record.executablePath -eq $Process.ExecutablePath -and
        $command -match 'node_modules\\vite\\bin\\vite\.js'
}

function Save-Service([string]$Service, $Process) {
    $serviceState[$Service] = @{
        pid = [int]$Process.ProcessId
        createdAt = $Process.CreationDate.ToUniversalTime().ToString('o')
        commandLine = $Process.CommandLine
        executablePath = $Process.ExecutablePath
    }
    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $runDirectory "$Service.pid") -Value $Process.ProcessId -Encoding Ascii
    @{
        projectRoot = $projectRoot
        frontend = $serviceState['frontend']
        backend = $serviceState['backend']
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

function Wait-Healthy([string]$Service) {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    do {
        try {
            if ($Service -eq 'backend') {
                $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
                if ($health.status -eq 'ok' -and $health.service -eq 'classroom-vision-ai') { return }
            } else {
                $page = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2
                if ($page.StatusCode -eq 200 -and $page.Content -match 'Classroom Vision AI') { return }
            }
        } catch { }
        Start-Sleep -Milliseconds 250
    } while ($timer.Elapsed.TotalSeconds -lt 15)
    throw "$Service did not become healthy. Check logs in $runDirectory."
}

function Stop-ServiceProcess([string]$Service) {
    $process = Get-Listener $Service
    if (-not $process -and $serviceState[$Service]) {
        $savedPid = [int]$serviceState[$Service].pid
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid"
    }
    if (-not $process) {
        Write-Host "$Service is already stopped."
        return
    }
    if (-not (Test-OwnedProcess $Service $process)) {
        throw "Cannot verify that PID $($process.ProcessId) belongs to this project's $Service. It was not stopped."
    }
    $parent = $null
    if ($Service -eq 'backend') {
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ParentProcessId)"
        if (-not (Test-OwnedProcess $Service $parent)) { $parent = $null }
    }
    Stop-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    if ($parent) { Stop-Process -Id $parent.ProcessId -ErrorAction SilentlyContinue }
    Write-Host "Stopped $Service."
}

if ($Stop) {
    Stop-ServiceProcess 'frontend'
    Stop-ServiceProcess 'backend'
    exit 0
}

if (-not (Test-Path -LiteralPath $viteScript)) {
    throw "Frontend dependencies are missing. Run npm ci inside $projectRoot."
}
if (-not (Test-Path -LiteralPath $backendPython)) {
    throw 'Backend environment is missing. Set up backend\.venv and install backend\requirements.txt first.'
}
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null

foreach ($service in @('backend', 'frontend')) {
    $process = Get-Listener $service
    if ($process -and -not (Test-OwnedProcess $service $process)) {
        throw "Port $(Get-ServicePort $service) is occupied by an unrelated process. It was not stopped."
    }
    if (-not $process) {
        if ($service -eq 'backend') {
            $executable = $backendPython
            $arguments = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000')
            $workingDirectory = Join-Path $projectRoot 'backend'
        } else {
            $executable = (Get-Command node.exe -ErrorAction Stop).Source
            $arguments = @(('"' + $viteScript + '"'), '--host', '127.0.0.1', '--port', '5173', '--strictPort')
            $workingDirectory = $projectRoot
        }
        $launchedProcess = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $workingDirectory `
            -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDirectory "$service.stdout.log") `
            -RedirectStandardError (Join-Path $runDirectory "$service.stderr.log") -PassThru
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($launchedProcess.Id)"
        if ($process) { Save-Service $service $process }
    }
    Wait-Healthy $service
    $process = Get-Listener $service
    if (-not (Test-OwnedProcess $service $process)) {
        throw "Could not verify the running $service process. Check $runDirectory."
    }
    Save-Service $service $process
    Write-Host "$service ready at http://127.0.0.1:$(Get-ServicePort $service) (PID $($process.ProcessId))"
}

if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173/' }
