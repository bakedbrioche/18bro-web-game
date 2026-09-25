# Blender and Codex setup on Windows

This setup lets Codex/Astra create and revise Blender assets through reviewed repository scripts. The command-line path is the reproducible release workflow. Blender's official experimental MCP integration is optional and should be enabled only after its exact release and local server command have been inspected.

## Installed tool

The operator installed Blender 5.2.2 LTS through the standard Windows installer. Codex located and successfully exercised the running executable at:

```text
C:\Program Files\Blender Foundation\Blender 5.2\blender.exe
```

The GUI and background Python/glTF path both work. `scripts/blender/create_18bro.py` generated the first authored `.blend`, self-contained GLB, animations, sockets, validation report, and review renders with this executable. Recheck the path and Blender version after an upgrade before regenerating release assets.

Official references:

- Blender LTS releases: <https://www.blender.org/download/lts/>
- Windows installation: <https://docs.blender.org/manual/en/5.2/getting_started/installing/windows.html>
- Command-line arguments: <https://docs.blender.org/manual/en/5.2/advanced/command_line/arguments.html>
- glTF 2.0 export: <https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html>

## Command-line smoke test

Run this from PowerShell with the actual installed path:

```powershell
$blenderExe = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
& $blenderExe --version
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python-expr 'import bpy; print(bpy.app.version_string)'
```

For a repository script:

```powershell
& $blenderExe --background --factory-startup --disable-autoexec --python-exit-code 1 --python '.\scripts\blender\smoke_test.py'
if ($LASTEXITCODE -ne 0) { throw 'Blender smoke test failed' }
```

Argument order matters. `--disable-autoexec` prevents automatic execution embedded in a `.blend` file; it does not sandbox a script explicitly passed with `--python`. Review repository scripts before running them.

The planned smoke script should create a temporary `.blend`, a named rigged mesh with a short animation, a PNG render, a self-contained GLB, and a JSON report with Blender version, nodes, bones, triangles, materials, actions, sockets, and hashes. Reopen the GLB in Blender and in the game's preview page before accepting the setup.

This acceptance path is now proven by the 18Bro builder. The official interactive Blender MCP remains optional and is not installed or required for asset generation.

## Working with Astra through Codex

The safe default workflow is:

1. Ask an Astra subagent to inspect the current asset contract and propose or edit a narrowly scoped script under `scripts/blender/`.
2. Have the chief agent review the actual diff.
3. Run the script in Blender background mode against a copy or generated file.
4. Validate the output and inspect it in `dist/preview.html` and a real run.
5. Commit the source `.blend`, exporter/validator changes, manifest, and approved GLB together only after the normal project gate passes.

This gives Astra full modeling capability through Blender's Python API without letting an interactive connection become part of the release build.

## Optional official Blender MCP

Blender Lab publishes an experimental MCP Server that requires Blender 5.1 or newer, its Blender add-on, an LLM client, and a local MCP server. Blender warns that generated Python can execute without filesystem or exfiltration safeguards, so use it on a clean local environment, keep it bound to loopback, and disable it whenever it is not in active use.

Official references:

- Blender Lab MCP Server: <https://www.blender.org/lab/mcp-server/>
- Codex MCP configuration: <https://learn.chatgpt.com/docs/extend/mcp?surface=cli>

Setup procedure:

1. Download the add-on and server only from the exact official Blender Lab release linked above. Do not substitute a similarly named package.
2. Inspect the release README, dependencies, launcher, and exposed tools before installation.
3. Install the Blender add-on from disk, then restart Blender and leave its listener disabled.
4. Install the server in an isolated environment and test that it binds only to the local machine.
5. Add a project-scoped server entry in `.codex/config.toml`. Codex uses project configuration only for trusted projects.
6. Start with the server disabled and prompt approval for every tool. Restart Codex, run `codex mcp list` or `/mcp`, and inspect the actual advertised tools before enabling them.
7. Use one Codex worker as the sole writer to a Blender process. Other agents may inspect files or prepare scripts, but must not drive that same GUI session concurrently.

Template only; fill in the reviewed official launcher and arguments from the chosen release:

```toml
[mcp_servers.blender]
command = 'C:/absolute/path/to/reviewed/server-launcher.exe'
args = []
enabled = false
startup_timeout_sec = 30
tool_timeout_sec = 180
default_tools_approval_mode = "prompt"
```

Do not guess the launcher or enable the entry until the official release is installed and inspected. Codex desktop, CLI, and IDE use the same MCP configuration.

## MCP acceptance and rollback

Before using the connection on project assets, make it inspect the scene, create one temporary named object, save a copy outside the authored source, reconnect cleanly, and stop without leaving a listener or process running. Then repeat on a disposable test file.

To roll back, disable or remove the project server table, disable the Blender add-on/listener, restart Codex and Blender, and remove the isolated server environment later. The deterministic Blender scripts and existing model assets continue to work without MCP.
