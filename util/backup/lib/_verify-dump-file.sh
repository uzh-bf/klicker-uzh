#!/bin/bash

# Reusable function for verifying dump files and reporting their size
# Usage: verify_dump_file "filename" [optional_min_size_bytes]
# Returns: 0 if file is valid, 1 if file is invalid or missing

verify_dump_file() {
    local dump_file="$1"
    local min_size="${2:-1}" # Default minimum size is 1 byte

    # Function for logging with timestamps
    log() {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
    }

    echo "  📊 Verifying dump file exists..."

    if [[ ! -f "$dump_file" ]]; then
        echo "  ❌ ERROR: Dump file not found at expected location: $dump_file"
        return 1
    fi

    # Resolve symlink to get the actual file
    local actual_file
    if [[ -L "$dump_file" ]]; then
        actual_file=$(readlink -f "$dump_file" 2>/dev/null || readlink "$dump_file" 2>/dev/null || echo "$dump_file")
        echo "  🔗 Symlink detected: $dump_file -> $actual_file"
    else
        actual_file="$dump_file"
    fi

    # Get file size in human-readable format
    local dump_size
    dump_size=$(ls -lh "$actual_file" | awk '{print $5}')

    # Get file size in bytes for additional verification
    local dump_size_bytes
    dump_size_bytes=$(stat -c%s "$actual_file" 2>/dev/null || stat -f%z "$actual_file" 2>/dev/null || echo "unknown")

    # Check if file has content (meets minimum size requirement)
    if [[ "$dump_size_bytes" == "unknown" ]]; then
        echo "  ⚠️  Warning: Cannot determine file size for verification"
        echo "  ✅ Dump file verified: $dump_file"
        echo "  📏 File size: $dump_size (size unknown)"
        echo "  📍 Full path: $(pwd)/$dump_file"
        echo "  🕐 Creation time: $(ls -l "$dump_file" | awk '{print $6, $7, $8}')"
        return 0
    elif [[ "$dump_size_bytes" -lt "$min_size" ]]; then
        echo "  ❌ ERROR: Dump file exists but is too small (${dump_size_bytes} bytes < ${min_size} bytes minimum)"
        echo "  📏 File size: $dump_size ($dump_size_bytes bytes)"
        echo "  📍 Full path: $(pwd)/$dump_file"
        return 1
    else
        echo "  ✅ Dump file verified: $dump_file"
        echo "  📏 File size: $dump_size ($dump_size_bytes bytes)"
        echo "  📍 Full path: $(pwd)/$dump_file"
        if [[ -L "$dump_file" ]]; then
            echo "  📍 Actual file: $actual_file"
            echo "  🕐 Actual file creation time: $(ls -l "$actual_file" | awk '{print $6, $7, $8}')"
        else
            echo "  🕐 Creation time: $(ls -l "$dump_file" | awk '{print $6, $7, $8}')"
        fi

        # Additional file type verification based on extension
        case "$actual_file" in
            *.tar)
                echo "  🗂️  File type: TAR archive"
                # Verify TAR file integrity
                if command -v tar &> /dev/null; then
                    if tar -tf "$actual_file" &> /dev/null; then
                        echo "  ✅ TAR file integrity verified"
                    else
                        echo "  ⚠️  Warning: TAR file may be corrupted"
                    fi
                fi
                ;;
            *.sql)
                echo "  🗃️  File type: SQL dump"
                # Check for basic SQL content
                if head -1 "$actual_file" | grep -q -E "(CREATE|DROP|INSERT|--)" 2>/dev/null; then
                    echo "  ✅ SQL file content verified"
                else
                    echo "  ⚠️  Warning: File may not contain valid SQL content"
                fi
                ;;
            *.dump)
                echo "  💾 File type: Binary dump"
                ;;
            *)
                echo "  📄 File type: Unknown"
                ;;
        esac

        return 0
    fi
}

# If script is called directly (not sourced), execute with provided arguments
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -eq 0 ]]; then
        echo "Usage: $0 <dump_file> [min_size_bytes]"
        echo "Example: $0 dump_20231201_123456.tar 1000"
        exit 1
    fi

    verify_dump_file "$@"
    exit $?
fi
