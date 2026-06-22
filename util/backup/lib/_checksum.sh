#!/usr/bin/env bash
# =============================================================================
# Backup File Checksum Verification Library
# =============================================================================
#
# This library provides functions for generating and verifying checksums of
# encrypted backup files to ensure data integrity during transfer and storage.
#
# Features:
# - SHA256 checksum generation and verification
# - Secure checksum file handling with proper permissions
# - Integration with existing backup logging system
# - Support for both creation and verification workflows
# - Detailed error reporting and recovery guidance
#
# =============================================================================

# Ensure we have access to the common restore functions for logging
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    # Being sourced - check if restore-common is already loaded
    if ! command -v log_info &> /dev/null; then
        # Try to source restore-common from the same directory
        CHECKSUM_LIB_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
        if [[ -f "$CHECKSUM_LIB_DIR/_restore-common.sh" ]]; then
            source "$CHECKSUM_LIB_DIR/_restore-common.sh"
        fi
    fi
fi

# =============================================================================
# CHECKSUM GENERATION FUNCTIONS
# =============================================================================

# Function to generate SHA256 checksum for a file
generate_checksum() {
    local file_path="$1"
    local checksum_file="${2:-}"
    
    # Validate input parameters
    if [[ -z "$file_path" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ File path is required for checksum generation"
        else
            echo "ERROR: File path is required for checksum generation" >&2
        fi
        return 1
    fi
    
    # Validate file exists and is readable
    if [[ ! -f "$file_path" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ File does not exist: $file_path"
        else
            echo "ERROR: File does not exist: $file_path" >&2
        fi
        return 1
    fi
    
    if [[ ! -r "$file_path" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ File is not readable: $file_path"
        else
            echo "ERROR: File is not readable: $file_path" >&2
        fi
        return 1
    fi
    
    # Determine checksum file path
    if [[ -z "$checksum_file" ]]; then
        checksum_file="${file_path}.sha256"
    fi
    
    if command -v log_info &> /dev/null; then
        log_info "🔍 Generating SHA256 checksum for $(basename "$file_path")..."
    else
        echo "Generating SHA256 checksum for $(basename "$file_path")..." >&2
    fi
    
    # Generate checksum with cross-platform compatibility
    local checksum_result
    if command -v sha256sum &> /dev/null; then
        # Linux/GNU coreutils
        checksum_result=$(sha256sum "$file_path")
    elif command -v shasum &> /dev/null; then
        # macOS/BSD
        checksum_result=$(shasum -a 256 "$file_path")
    else
        if command -v log_warning &> /dev/null; then
            log_warning "❌ No SHA256 utility found (tried sha256sum, shasum)"
            log_warning "💡 Install coreutils: brew install coreutils"
        else
            echo "ERROR: No SHA256 utility found (tried sha256sum, shasum)" >&2
            echo "Install coreutils: brew install coreutils" >&2
        fi
        return 1
    fi
    
    # Extract just the checksum (first field)
    local checksum
    checksum=$(echo "$checksum_result" | awk '{print $1}')
    
    if [[ -z "$checksum" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ Failed to generate checksum"
        else
            echo "ERROR: Failed to generate checksum" >&2
        fi
        return 1
    fi
    
    # Create checksum file with secure permissions
    if ! echo "$checksum  $(basename "$file_path")" > "$checksum_file"; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ Failed to write checksum file: $checksum_file"
        else
            echo "ERROR: Failed to write checksum file: $checksum_file" >&2
        fi
        return 1
    fi
    
    # Set secure permissions on checksum file
    chmod 644 "$checksum_file" 2>/dev/null || true
    
    # Get file size for reporting
    local file_size
    file_size=$(du -h "$file_path" | cut -f1)
    
    if command -v log_success &> /dev/null; then
        log_success "✅ Checksum generated successfully"
        log_info "   📁 File: $(basename "$file_path") ($file_size)"
        log_info "   🔍 SHA256: ${checksum:0:16}...${checksum: -16}"
        log_info "   📄 Saved to: $(basename "$checksum_file")"
    else
        echo "✅ Checksum generated successfully" >&2
        echo "   📁 File: $(basename "$file_path") ($file_size)" >&2
        echo "   🔍 SHA256: ${checksum:0:16}...${checksum: -16}" >&2
        echo "   📄 Saved to: $(basename "$checksum_file")" >&2
    fi
    
    # Return the checksum value
    printf "%s" "$checksum"
    return 0
}

# =============================================================================
# CHECKSUM VERIFICATION FUNCTIONS
# =============================================================================

# Function to verify SHA256 checksum for a file
verify_checksum() {
    local file_path="$1"
    local checksum_file="${2:-}"
    local skip_missing="${3:-false}"
    
    # Validate input parameters
    if [[ -z "$file_path" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ File path is required for checksum verification"
        else
            echo "ERROR: File path is required for checksum verification" >&2
        fi
        return 1
    fi
    
    # Determine checksum file path
    if [[ -z "$checksum_file" ]]; then
        checksum_file="${file_path}.sha256"
    fi
    
    # Check if checksum file exists
    if [[ ! -f "$checksum_file" ]]; then
        if [[ "$skip_missing" == "true" ]]; then
            if command -v log_warning &> /dev/null; then
                log_warning "⚠️  Checksum file not found: $(basename "$checksum_file") (skipping verification)"
            else
                echo "WARNING: Checksum file not found: $(basename "$checksum_file") (skipping verification)" >&2
            fi
            return 0
        else
            if command -v log_warning &> /dev/null; then
                log_warning "❌ Checksum file not found: $(basename "$checksum_file")"
                log_warning "💡 Generate checksums during backup creation or use --skip-checksum to bypass"
            else
                echo "ERROR: Checksum file not found: $(basename "$checksum_file")" >&2
                echo "Generate checksums during backup creation or use --skip-checksum to bypass" >&2
            fi
            return 1
        fi
    fi
    
    # Validate main file exists
    if [[ ! -f "$file_path" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ File does not exist: $file_path"
        else
            echo "ERROR: File does not exist: $file_path" >&2
        fi
        return 1
    fi
    
    if command -v log_info &> /dev/null; then
        log_info "🔍 Verifying SHA256 checksum for $(basename "$file_path")..."
    else
        echo "Verifying SHA256 checksum for $(basename "$file_path")..." >&2
    fi
    
    # Read expected checksum from file
    local expected_checksum
    expected_checksum=$(awk '{print $1}' "$checksum_file" | head -1)
    
    if [[ -z "$expected_checksum" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ Could not read checksum from: $(basename "$checksum_file")"
        else
            echo "ERROR: Could not read checksum from: $(basename "$checksum_file")" >&2
        fi
        return 1
    fi
    
    # Validate checksum format (SHA256 should be 64 hex characters)
    if [[ ! "$expected_checksum" =~ ^[a-fA-F0-9]{64}$ ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ Invalid checksum format in: $(basename "$checksum_file")"
            log_warning "💡 Expected 64 hexadecimal characters, got: ${#expected_checksum} characters"
        else
            echo "ERROR: Invalid checksum format in: $(basename "$checksum_file")" >&2
            echo "Expected 64 hexadecimal characters, got: ${#expected_checksum} characters" >&2
        fi
        return 1
    fi
    
    # Calculate actual checksum
    local actual_checksum
    if command -v sha256sum &> /dev/null; then
        # Linux/GNU coreutils
        actual_checksum=$(sha256sum "$file_path" | awk '{print $1}')
    elif command -v shasum &> /dev/null; then
        # macOS/BSD
        actual_checksum=$(shasum -a 256 "$file_path" | awk '{print $1}')
    else
        if command -v log_warning &> /dev/null; then
            log_warning "❌ No SHA256 utility found (tried sha256sum, shasum)"
            log_warning "💡 Install coreutils: brew install coreutils"
        else
            echo "ERROR: No SHA256 utility found (tried sha256sum, shasum)" >&2
            echo "Install coreutils: brew install coreutils" >&2
        fi
        return 1
    fi
    
    if [[ -z "$actual_checksum" ]]; then
        if command -v log_warning &> /dev/null; then
            log_warning "❌ Failed to calculate checksum for file"
        else
            echo "ERROR: Failed to calculate checksum for file" >&2
        fi
        return 1
    fi
    
    # Compare checksums (case-insensitive)
    if [[ "$(echo "$actual_checksum" | tr '[:upper:]' '[:lower:]')" == "$(echo "$expected_checksum" | tr '[:upper:]' '[:lower:]')" ]]; then
        # Get file size for reporting
        local file_size
        file_size=$(du -h "$file_path" | cut -f1)
        
        if command -v log_success &> /dev/null; then
            log_success "✅ Checksum verification passed"
            log_info "   📁 File: $(basename "$file_path") ($file_size)"
            log_info "   🔍 SHA256: ${actual_checksum:0:16}...${actual_checksum: -16}"
            log_info "   ✅ File integrity confirmed"
        else
            echo "✅ Checksum verification passed" >&2
            echo "   📁 File: $(basename "$file_path") ($file_size)" >&2
            echo "   🔍 SHA256: ${actual_checksum:0:16}...${actual_checksum: -16}" >&2
            echo "   ✅ File integrity confirmed" >&2
        fi
        return 0
    else
        # Checksum mismatch - this is a serious security issue
        if command -v log_warning &> /dev/null; then
            log_warning "❌ CHECKSUM VERIFICATION FAILED!"
            log_warning "🚨 File integrity compromised - possible corruption or tampering"
            log_warning ""
            log_warning "📄 File: $(basename "$file_path")"
            log_warning "🔍 Expected: ${expected_checksum:0:16}...${expected_checksum: -16}"
            log_warning "🔍 Actual:   ${actual_checksum:0:16}...${actual_checksum: -16}"
            log_warning ""
            log_warning "💡 Possible causes:"
            log_warning "   • File was corrupted during transfer or storage"
            log_warning "   • File was modified after checksum generation"
            log_warning "   • Storage media error or network transmission issue"
            log_warning "   • Potential security breach or tampering"
            log_warning ""
            log_warning "🔧 Recommended actions:"
            log_warning "   1. Re-download or re-transfer the backup file"
            log_warning "   2. Use a different backup file from a trusted source"
            log_warning "   3. Check storage media for errors"
            log_warning "   4. Contact administrator if this persists"
            log_warning "   5. Use --skip-checksum only if absolutely necessary"
        else
            echo "❌ CHECKSUM VERIFICATION FAILED!" >&2
            echo "🚨 File integrity compromised - possible corruption or tampering" >&2
            echo "" >&2
            echo "📄 File: $(basename "$file_path")" >&2
            echo "🔍 Expected: ${expected_checksum:0:16}...${expected_checksum: -16}" >&2
            echo "🔍 Actual:   ${actual_checksum:0:16}...${actual_checksum: -16}" >&2
            echo "" >&2
            echo "💡 Possible causes:" >&2
            echo "   • File was corrupted during transfer or storage" >&2
            echo "   • File was modified after checksum generation" >&2
            echo "   • Storage media error or network transmission issue" >&2
            echo "   • Potential security breach or tampering" >&2
            echo "" >&2
            echo "🔧 Recommended actions:" >&2
            echo "   1. Re-download or re-transfer the backup file" >&2
            echo "   2. Use a different backup file from a trusted source" >&2
            echo "   3. Check storage media for errors" >&2
            echo "   4. Contact administrator if this persists" >&2
            echo "   5. Use --skip-checksum only if absolutely necessary" >&2
        fi
        return 1
    fi
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Function to check if checksum verification is available
checksum_verification_available() {
    if command -v sha256sum &> /dev/null || command -v shasum &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to get checksum from file without verification
get_stored_checksum() {
    local checksum_file="$1"
    
    if [[ -z "$checksum_file" ]]; then
        return 1
    fi
    
    if [[ ! -f "$checksum_file" ]]; then
        return 1
    fi
    
    awk '{print $1}' "$checksum_file" | head -1
}

# Function to display checksum information for a file
show_checksum_info() {
    local file_path="$1"
    local checksum_file="${2:-${file_path}.sha256}"
    
    if [[ ! -f "$file_path" ]]; then
        echo "File not found: $file_path"
        return 1
    fi
    
    local file_size
    file_size=$(du -h "$file_path" | cut -f1)
    
    echo "📁 File: $(basename "$file_path") ($file_size)"
    
    if [[ -f "$checksum_file" ]]; then
        local stored_checksum
        stored_checksum=$(get_stored_checksum "$checksum_file")
        if [[ -n "$stored_checksum" ]]; then
            echo "🔍 Stored checksum: ${stored_checksum:0:16}...${stored_checksum: -16}"
            echo "📄 Checksum file: $(basename "$checksum_file")"
        else
            echo "❌ Invalid checksum file: $(basename "$checksum_file")"
        fi
    else
        echo "⚠️  No checksum file found: $(basename "$checksum_file")"
    fi
}

# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

# Export functions for use by other scripts
export -f generate_checksum verify_checksum
export -f checksum_verification_available get_stored_checksum show_checksum_info