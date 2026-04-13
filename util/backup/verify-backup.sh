#!/bin/bash

# =============================================================================
# Backup Verification Tool
# =============================================================================
#
# Standalone tool for verifying backup files manually or in batch.
# Can test individual backup files or all backups in a directory.
#
# Usage:
#   ./verify-backup.sh <backup_file>                    # Verify single file
#   ./verify-backup.sh --batch <directory> [pattern]    # Verify all files in directory
#   ./verify-backup.sh --report <backup_file>           # Generate detailed report
#   ./verify-backup.sh --help                           # Show help
#
# Examples:
#   ./verify-backup.sh /path/to/dump_20231201_123456.tar.gpg
#   ./verify-backup.sh --batch /path/to/backups/ "*.gpg"
#   ./verify-backup.sh --report /path/to/backup.tar.gpg
#
# =============================================================================

# Script directory for sourcing utilities
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Source required utilities
if [[ -f "$SCRIPT_DIR/lib/_restore-common.sh" ]]; then
    source "$SCRIPT_DIR/lib/_restore-common.sh"
else
    echo "ERROR: Required utilities not found at $SCRIPT_DIR/lib/_restore-common.sh" >&2
    echo "Please ensure you're running this script from the util/backup directory" >&2
    exit 1
fi

if [[ -f "$SCRIPT_DIR/lib/_backup-verify.sh" ]]; then
    source "$SCRIPT_DIR/lib/_backup-verify.sh"
else
    echo "ERROR: Backup verification utilities not found at $SCRIPT_DIR/lib/_backup-verify.sh" >&2
    echo "Please ensure the backup verification library is available" >&2
    exit 1
fi

# Source checksum utilities if available
if [[ -f "$SCRIPT_DIR/lib/_checksum.sh" ]]; then
    source "$SCRIPT_DIR/lib/_checksum.sh"
fi

# =============================================================================
# CONFIGURATION AND CONSTANTS
# =============================================================================

readonly SCRIPT_NAME="$(basename "$0")"
readonly VERSION="1.0.0"

# =============================================================================
# HELP AND USAGE FUNCTIONS
# =============================================================================

show_usage() {
    cat << EOF
Backup Verification Tool v${VERSION}

DESCRIPTION:
    Verify KlickerUZH backup files for integrity and decryption capability.
    Can test individual files or batch verify entire directories.

USAGE:
    $SCRIPT_NAME <backup_file>                    # Verify single file
    $SCRIPT_NAME --batch <directory> [pattern]    # Verify all files matching pattern
    $SCRIPT_NAME --report <backup_file>           # Generate detailed verification report
    $SCRIPT_NAME --quick <backup_file>            # Quick verification (skip checksums)
    $SCRIPT_NAME --help                           # Show this help

ARGUMENTS:
    backup_file     Path to encrypted backup file (.gpg)
    directory       Directory containing backup files
    pattern         File pattern for batch mode (default: "*.gpg")

OPTIONS:
    --batch         Verify all backup files in a directory
    --report        Generate detailed verification report
    --quick         Skip checksum verification for faster results
    --verbose       Show detailed output during verification
    --quiet         Suppress non-essential output
    --help          Show this help and exit

EXAMPLES:
    # Verify a single backup file
    $SCRIPT_NAME /path/to/dump_20231201_123456.tar.gpg

    # Verify all .gpg files in a directory
    $SCRIPT_NAME --batch /path/to/backups/

    # Verify only database backups
    $SCRIPT_NAME --batch /path/to/backups/ "*dump*.gpg"

    # Generate detailed report
    $SCRIPT_NAME --report /path/to/backup.tar.gpg

    # Quick verification without checksums
    $SCRIPT_NAME --quick /path/to/backup.tar.gpg

REQUIREMENTS:
    - BACKUP_ENCRYPTION_KEY environment variable must be set
    - GPG must be installed and available
    - Backup files must be encrypted with the same key

ENVIRONMENT VARIABLES:
    BACKUP_ENCRYPTION_KEY    Required for decryption testing
    DEBUG_RESTORE           Set to "true" for additional debug output

EXIT CODES:
    0    All verifications passed
    1    Verification failed or error occurred
    2    Invalid arguments or missing requirements
EOF
}

show_version() {
    echo "$SCRIPT_NAME version $VERSION"
}

# =============================================================================
# ARGUMENT PARSING AND VALIDATION
# =============================================================================

# Default options
BATCH_MODE=false
REPORT_MODE=false
QUICK_MODE=false
VERBOSE=false
QUIET=false
BACKUP_FILE=""
BACKUP_DIR=""
FILE_PATTERN="*.gpg"

# Parse command line arguments
parse_arguments() {
    if [[ $# -eq 0 ]]; then
        echo "ERROR: No arguments provided" >&2
        echo "Use --help for usage information" >&2
        exit 2
    fi

    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --version|-v)
                show_version
                exit 0
                ;;
            --batch)
                BATCH_MODE=true
                shift
                if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                    BACKUP_DIR="$1"
                    shift
                    # Optional pattern argument
                    if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                        FILE_PATTERN="$1"
                        shift
                    fi
                else
                    echo "ERROR: --batch requires a directory argument" >&2
                    exit 2
                fi
                ;;
            --report)
                REPORT_MODE=true
                shift
                if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                    BACKUP_FILE="$1"
                    shift
                else
                    echo "ERROR: --report requires a backup file argument" >&2
                    exit 2
                fi
                ;;
            --quick)
                QUICK_MODE=true
                shift
                if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                    BACKUP_FILE="$1"
                    shift
                else
                    echo "ERROR: --quick requires a backup file argument" >&2
                    exit 2
                fi
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --quiet)
                QUIET=true
                shift
                ;;
            --*)
                echo "ERROR: Unknown option: $1" >&2
                echo "Use --help for usage information" >&2
                exit 2
                ;;
            *)
                if [[ -z "$BACKUP_FILE" ]]; then
                    BACKUP_FILE="$1"
                    shift
                else
                    echo "ERROR: Unexpected argument: $1" >&2
                    echo "Use --help for usage information" >&2
                    exit 2
                fi
                ;;
        esac
    done

    # Validate arguments
    if [[ "$BATCH_MODE" == "true" ]]; then
        if [[ -z "$BACKUP_DIR" ]]; then
            echo "ERROR: Batch mode requires a directory" >&2
            exit 2
        fi
        if [[ ! -d "$BACKUP_DIR" ]]; then
            echo "ERROR: Directory not found: $BACKUP_DIR" >&2
            exit 2
        fi
    elif [[ "$REPORT_MODE" == "true" ]] || [[ "$QUICK_MODE" == "true" ]] || [[ -n "$BACKUP_FILE" ]]; then
        if [[ -z "$BACKUP_FILE" ]]; then
            echo "ERROR: Backup file required" >&2
            exit 2
        fi
        if [[ ! -f "$BACKUP_FILE" ]]; then
            echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
            exit 2
        fi
    else
        echo "ERROR: No valid operation specified" >&2
        echo "Use --help for usage information" >&2
        exit 2
    fi

    # Set quiet mode for verbose conflict
    if [[ "$VERBOSE" == "true" && "$QUIET" == "true" ]]; then
        echo "WARNING: --verbose and --quiet are conflicting, using --verbose" >&2
        QUIET=false
    fi
}

# =============================================================================
# VERIFICATION FUNCTIONS
# =============================================================================

# Function to verify prerequisites
check_prerequisites() {
    local missing_requirements=()

    # Check for GPG
    if ! command -v gpg &> /dev/null; then
        missing_requirements+=("gpg (GNU Privacy Guard)")
    fi

    # Check for encryption key
    if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        missing_requirements+=("BACKUP_ENCRYPTION_KEY environment variable")
    fi

    if [[ ${#missing_requirements[@]} -gt 0 ]]; then
        echo "ERROR: Missing requirements:" >&2
        for req in "${missing_requirements[@]}"; do
            echo "  - $req" >&2
        done
        echo "" >&2
        echo "Please ensure all requirements are met before running verification" >&2
        exit 2
    fi
}

# Function for single file verification
verify_single_file() {
    local file="$1"
    local skip_checksum="$2"

    if [[ "$QUIET" != "true" ]]; then
        echo "🔍 Verifying backup: $(basename "$file")"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    fi

    local verification_result=0

    if [[ "$skip_checksum" == "true" ]]; then
        # Quick mode - skip checksums
        if ! verify_backup_decrypt "$file"; then
            verification_result=1
        fi
    else
        # Full verification
        if ! verify_backup_comprehensive "$file" false; then
            verification_result=1
        fi
    fi

    if [[ "$QUIET" != "true" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        if [[ $verification_result -eq 0 ]]; then
            echo "✅ VERIFICATION PASSED: $(basename "$file")"
        else
            echo "❌ VERIFICATION FAILED: $(basename "$file")"
        fi
        echo ""
    fi

    return $verification_result
}

# Function for batch verification with enhanced reporting
verify_batch_enhanced() {
    local backup_dir="$1"
    local pattern="$2"

    if [[ "$QUIET" != "true" ]]; then
        echo "🔍 Batch Backup Verification"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Directory: $backup_dir"
        echo "Pattern: $pattern"
        echo ""
    fi

    # Use the batch verification function from the library
    if verify_backups_batch "$backup_dir" "$pattern"; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    # Parse command line arguments
    parse_arguments "$@"

    # Check prerequisites
    check_prerequisites

    # Set debug mode if verbose
    if [[ "$VERBOSE" == "true" ]]; then
        export DEBUG_RESTORE="true"
    fi

    # Execute based on mode
    local exit_code=0

    if [[ "$BATCH_MODE" == "true" ]]; then
        if ! verify_batch_enhanced "$BACKUP_DIR" "$FILE_PATTERN"; then
            exit_code=1
        fi
    elif [[ "$REPORT_MODE" == "true" ]]; then
        # Generate detailed report
        if [[ "$QUIET" != "true" ]]; then
            echo "📋 Generating verification report for: $(basename "$BACKUP_FILE")"
        fi
        
        # Verify first
        if verify_single_file "$BACKUP_FILE" false; then
            # Create report
            local report_file="${BACKUP_FILE%.gpg}_verification_report.txt"
            create_backup_report "$BACKUP_FILE" "$report_file"
            
            if [[ "$QUIET" != "true" ]]; then
                echo "✅ Report generated: $report_file"
            fi
        else
            exit_code=1
        fi
    else
        # Single file verification
        local skip_checksum="false"
        if [[ "$QUICK_MODE" == "true" ]]; then
            skip_checksum="true"
        fi
        
        if ! verify_single_file "$BACKUP_FILE" "$skip_checksum"; then
            exit_code=1
        fi
    fi

    # Final summary
    if [[ "$QUIET" != "true" ]]; then
        if [[ $exit_code -eq 0 ]]; then
            echo "🎉 All verifications completed successfully!"
        else
            echo "⚠️  Some verifications failed - please check the output above"
        fi
    fi

    exit $exit_code
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Set up error handling
set -euo pipefail

# Execute main function with all arguments
main "$@"