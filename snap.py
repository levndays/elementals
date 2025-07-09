import os
import datetime

# --- Configuration ---
DEFAULT_PROJECT_ROOT = os.getcwd()
DEFAULT_OUTPUT_FILE = "project_snapshot_py.txt"

# --- Folders and files to COMPLETELY EXCLUDE ---
EXCLUDED_FOLDERS_AND_FILES = [
    ".git", ".hg", ".svn",
    ".idea", ".vscode",
    ".dart_tool", "build",
    "ios/Pods", "ios/.symlinks", "ios/Flutter/App.framework", "ios/Flutter/Flutter.framework",
    "ios/Flutter/engine", "ios/Flutter/ephemeral", "ios/DerivedData",
    "ios/Runner/Assets.xcassets", "ios/Runner.xcworkspace/xcuserdata",
    "android/.gradle", "android/app/build", "android/build",
    "android/key.properties", "android/local.properties",
    "android/gradlew", "android/gradlew.bat", "android/gradle/wrapper/gradle-wrapper.jar",
    "linux/flutter/ephemeral", "macos/flutter/ephemeral", "windows/flutter/ephemeral",
    "web/build",
    "pubspec.lock",
    "functions/node_modules", "functions/lib"
]

# --- File extensions to COMPLETELY EXCLUDE ---
EXCLUDED_EXTENSIONS = [
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
    ".mp3", ".wav", ".ogg", ".m4a",
    ".mp4", ".mov", ".avi", ".webm",
    ".ttf", ".otf", ".woff", ".woff2",
    ".zip", ".gz", ".tar", ".rar", ".7z",
    ".a", ".so", ".dll", ".exe", ".obj", ".o", ".dylib",
    ".jar", ".class", ".keystore", ".jks",
    ".log", ".DS_Store", ".swp", ".swo"
]

# --- Files to OMIT CONTENT (listed but not included) ---
CONTENT_OMITTED_PATTERNS = [
    ".flutter-plugins-dependencies",
    "lib/firebase_options.dart",
    "android/app/src/main/java/io/flutter/plugins/GeneratedPluginRegistrant.java",
    "ios/Runner/GeneratedPluginRegistrant.h",
    "ios/Runner/GeneratedPluginRegistrant.m",
    "ios/Flutter/Generated.xcconfig"
]

def should_completely_exclude(path, project_root, dynamic_exclusions_set):
    """Determine if a file or folder should be completely excluded from the snapshot."""
    relative_path = os.path.relpath(path, project_root).replace(os.sep, '/')

    if relative_path in dynamic_exclusions_set:
        return True

    for excluded_item in EXCLUDED_FOLDERS_AND_FILES:
        if excluded_item.startswith("*."):
            if relative_path.endswith(excluded_item[1:]):
                return True
        elif relative_path.startswith(excluded_item + '/') or relative_path == excluded_item:
            return True

    if os.path.isfile(path):
        _, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext in EXCLUDED_EXTENSIONS:
            return True

    return False

def should_omit_content(relative_path, dynamic_content_omit_set):
    """Determine if the file's content should be omitted from the snapshot."""
    if relative_path in dynamic_content_omit_set:
        return True
    for pattern in CONTENT_OMITTED_PATTERNS:
        if relative_path == pattern:
            return True
    return False

def create_project_snapshot(project_root=DEFAULT_PROJECT_ROOT, output_file_name=DEFAULT_OUTPUT_FILE):
    """Create a snapshot of the project by walking through the files and writing relevant content."""
    output_file_path = os.path.join(project_root, output_file_name)
    dynamic_exclusions_set = {output_file_name}
    dynamic_content_omit_set = set(CONTENT_OMITTED_PATTERNS)

    current_script_path = os.path.abspath(__file__)
    current_script_rel = os.path.relpath(current_script_path, project_root).replace(os.sep, '/')
    if current_script_rel != output_file_name:
        dynamic_content_omit_set.add(current_script_rel)

    print(f"Project Root: {project_root}")
    print(f"Output File: {output_file_path}")

    with open(output_file_path, "w", encoding="utf-8", errors="ignore") as outfile:
        outfile.write("Flutter Project Snapshot (Python Script)\n")
        outfile.write(f"Project Root: {project_root}\n")
        outfile.write(f"Snapshot created on: {datetime.datetime.now().isoformat()}\n")
        outfile.write("=" * 80 + "\n\n")

        for root, dirs, files in os.walk(project_root, topdown=True):
            dirs[:] = [d for d in dirs if not should_completely_exclude(os.path.join(root, d), project_root, dynamic_exclusions_set)]

            for filename in files:
                filepath = os.path.join(root, filename)
                relative_filepath = os.path.relpath(filepath, project_root).replace(os.sep, '/')

                if should_completely_exclude(filepath, project_root, dynamic_exclusions_set):
                    print(f"Excluding: {relative_filepath}")
                    continue

                print(f"Processing: {relative_filepath}")
                outfile.write(f"=== FILE: {relative_filepath} ===\n")
                outfile.write("-" * 50 + "\n")

                if should_omit_content(relative_filepath, dynamic_content_omit_set):
                    outfile.write("[Content Omitted - Generated/Tooling File]\n")
                else:
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as infile:
                            outfile.write(infile.read())
                    except Exception as e:
                        outfile.write(f"[Error reading file: {e}]\n")

                outfile.write("\n" + "-" * 50 + "\n")
                outfile.write(f"=== END OF FILE: {relative_filepath} ===\n\n\n")

        outfile.write("=" * 80 + "\n")
        outfile.write("Snapshot Complete.\n")

    print(f"Project snapshot created: {output_file_path}")

if __name__ == "__main__":
    create_project_snapshot()
