#!/bin/bash

# =============================================================================
# Backup Verification Utilities
# =============================================================================
#
# This script provides verification functions for testing backups immediately
# after creation to ensure they can be successfully decrypted and restored.
# It includes functionality for:
# - Immediate post-encryption verification
# - Sample data extraction and validation
# - Integrity checking with checksums
# - Performance-optimized streaming verification
#
# Usage: source this script in your backup scripts
# =============================================================================

# Ensure common utilities are loaded
if [[ "${RESTORE_COMMON_LOADED:-}" != "true" ]]; then
    # Try to load common utilities from the same directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    if [[ -f "$SCRIPT_DIR/_restore-common.sh" ]]; then
        source "$SCRIPT_DIR/_restore-common.sh"
    else
        echo "ERROR: Common utilities not found. Please ensure _restore-common.sh is available." >&2
        exit 1
    fi
fi

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Cross-platform function to format file sizes
format_file_size() {
    local size="$1"
    local units=("B" "K" "M" "G" "T")
    local unit_index=0
    local size_float="$size"
    
    while (( $(echo "$size_float >= 1024" | bc -l 2>/dev/null || echo "0") )) && (( unit_index < 4 )); do
        size_float=$(echo "scale=1; $size_float / 1024" | bc -l 2>/dev/null || echo "$size")
        ((unit_index++))
    done
    
    # Format with appropriate decimal places
    if (( unit_index == 0 )); then
        echo "${size}${units[$unit_index]}"
    else
        printf "%.1f%s
" "$size_float" "${units[$unit_index]}"
    fi
}

# =============================================================================
# BACKUP VERIFICATION FUNCTIONS
# =============================================================================

# Function to verify a backup can be decrypted
verify_backup_decrypt() {
    local backup_file="$1"
    local sample_size="${2:-1048576}" # Default: 1MB sample
    local encryption_key="${3:-${BACKUP_ENCRYPTION_KEY:-}}"
    
    log_info "🔍 Verifying backup decryption for $(basename "$backup_file")"
    
    # Validate input
    if [[ ! -f "$backup_file" ]]; then
        log_warning "❌ Backup file not found: $backup_file"
        return 1
    fi
    
    # Check if file is encrypted (should end with .gpg)
    if [[ "$backup_file" != *.gpg ]]; then
        log_warning "❌ File is not encrypted (doesn't end with .gpg): $backup_file"
        return 1
    fi
    
    # Verify encryption key is available
    if [[ -z "$encryption_key" ]]; then
        log_warning "❌ No encryption key provided or in environment"
        return 1
    fi
    
    # Debug output to check key availability
    if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
        log_info "   🐛 Debug: Encryption key length: ${#encryption_key}"
    fi
    
    log_info "   🔐 Testing GPG decryption with AES256 cipher..."
    
    # Create temporary file for sample extraction
    local temp_sample
    temp_sample=$(create_secure_temp_file "verify_sample" ".tmp")
    
    # Test decryption by extracting a sample (first 1MB)
    # Use the same parameters as the restore process
    local gpg_error_file
    gpg_error_file=$(create_secure_temp_file "gpg_error" ".log")
    
    # Note: We need to handle the pipeline carefully since head -c can cause SIGPIPE
    local pipeline_exit_code=0
    if ! gpg --batch --yes --passphrase "$encryption_key" \
            --cipher-algo AES256 --decrypt "$backup_file" 2>"$gpg_error_file" | \
            head -c "$sample_size" > "$temp_sample"; then
        pipeline_exit_code=1
    fi
    
    # Read GPG error output for diagnosis
    local gpg_error_output=""
    if [[ -s "$gpg_error_file" ]]; then
        gpg_error_output=$(cat "$gpg_error_file")
    fi
    
    # Check if this is just a broken pipe error (which is normal with head -c)
    if [[ $pipeline_exit_code -ne 0 ]]; then
        if [[ "$gpg_error_output" == *"Broken pipe"* ]] && [[ "$gpg_error_output" == *"encrypted with 1 passphrase"* ]]; then
            # This is normal - GPG decrypted successfully but head terminated the pipe
            if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
                log_info "   🐛 GPG decryption successful (broken pipe is normal with head -c)"
            fi
        else
            # This is a real error
            if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
                log_warning "   🐛 GPG error output: $gpg_error_output"
            fi
            
            log_warning "❌ GPG decryption failed"
            secure_delete_file "$temp_sample"
            secure_delete_file "$gpg_error_file"
            return 1
        fi
    fi
    
    # Clean up error file
    secure_delete_file "$gpg_error_file"
    
    # Check if we got any data
    local sample_size_actual
    sample_size_actual=$(stat -c%s "$temp_sample" 2>/dev/null || stat -f%z "$temp_sample" 2>/dev/null || echo "0")
    
    if [[ "$sample_size_actual" -eq 0 ]]; then
        log_warning "❌ No data extracted during decryption test"
        secure_delete_file "$temp_sample"
        return 1
    fi
    
    log_info "   ✅ Extracted $(format_file_size "$sample_size_actual") sample data"
    
    # Validate sample content based on backup type
    if ! validate_backup_sample "$temp_sample" "$backup_file"; then
        log_warning "❌ Sample data validation failed"
        secure_delete_file "$temp_sample"
        return 1
    fi
    
    # Clean up
    secure_delete_file "$temp_sample"
    
    log_info "   ✅ Backup decryption verification successful"
    return 0
}

# Function to validate sample backup content
validate_backup_sample() {
    local sample_file="$1"
    local backup_file="$2"
    
    # Determine backup type from filename
    local backup_type="unknown"
    if [[ "$backup_file" == *"redis"* ]]; then
        backup_type="redis"
    elif [[ "$backup_file" == *"dump"* ]] || [[ "$backup_file" == *"db"* ]]; then
        backup_type="database"
    fi
    
    case "$backup_type" in
        "database")
            # Check for TAR archive signature or PostgreSQL dump content
            if file "$sample_file" | grep -q "POSIX tar archive" 2>/dev/null; then
                log_info "   ✅ Valid TAR archive detected"
                return 0
            elif head -100 "$sample_file" | grep -q -E "(CREATE|DROP|INSERT|COPY|PostgreSQL)" 2>/dev/null; then
                log_info "   ✅ Valid SQL dump content detected"
                return 0
            else
                log_warning "   ⚠️  Sample doesn't appear to be valid database backup"
                # Show first few bytes for debugging (safely)
                if [[ "${DEBUG_RESTORE:-}" == "true" ]]; then
                    log_warning "   🐛 Sample header: $(head -c 50 "$sample_file" | xxd -l 50 -p)"
                fi
                return 1
            fi
            ;;
        "redis")
            # Check for Redis dump format or command signatures
            if head -100 "$sample_file" | grep -q -E "(REDIS|SET|HSET|SADD|ZADD|\*[0-9])" 2>/dev/null; then
                log_info "   ✅ Valid Redis dump content detected"
                return 0
            else
                log_warning "   ⚠️  Sample doesn't appear to be valid Redis backup"
                return 1
            fi
            ;;
        *)
            # Unknown type - just check if we have non-empty data
            if [[ -s "$sample_file" ]]; then
                log_info "   ✅ Sample contains data (type unknown)"
                return 0
            else
                log_warning "   ❌ Sample file is empty"
                return 1
            fi
            ;;
    esac
}

# Function to perform comprehensive backup verification
verify_backup_comprehensive() {
    local backup_file="$1"
    local skip_checksum="${2:-false}"
    
    log_info "🔍 Performing comprehensive backup verification"
    
    # 1. File existence and basic validation
    if [[ ! -f "$backup_file" ]]; then
        log_warning "❌ Backup file not found: $backup_file"
        return 1
    fi
    
    local file_size
    file_size=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null || echo "0")
    
    if [[ "$file_size" -eq 0 ]]; then
        log_warning "❌ Backup file is empty"
        return 1
    fi
    
    log_info "   📏 File size: $(format_file_size "$file_size")"
    
    # 2. Checksum verification (if enabled and available)
    if [[ "$skip_checksum" != "true" ]] && command -v verify_checksum &> /dev/null; then
        log_info "   🔍 Verifying file integrity checksum..."
        if verify_checksum "$backup_file" "" true; then
            log_info "   ✅ Checksum verification passed"
        else
            log_warning "   ❌ Checksum verification failed"
            return 1
        fi
    else
        log_info "   ⏭️  Skipping checksum verification"
    fi
    
    # 3. GPG file format validation
    log_info "   🔍 Validating GPG file format..."
    local file_type
    file_type=$(file "$backup_file" 2>/dev/null || echo "unknown")
    
    if [[ "$file_type" == *"GPG symmetrically encrypted data"* ]]; then
        log_info "   ✅ Valid GPG encrypted file"
    elif [[ "$file_type" == *"data"* ]]; then
        log_info "   ✅ Binary encrypted data detected"
    else
        log_warning "   ⚠️  File type: $file_type"
        log_warning "   ⚠️  May not be properly encrypted"
    fi
    
    # 4. Decryption test
    if ! verify_backup_decrypt "$backup_file" 1048576 "${BACKUP_ENCRYPTION_KEY:-}"; then
        log_warning "❌ Decryption verification failed"
        return 1
    fi
    
    log_info "🎉 Comprehensive backup verification successful"
    return 0
}

# Function to verify backup with progress indication
verify_backup_with_progress() {
    local backup_file="$1"
    local show_progress="${2:-true}"
    
    if [[ "$show_progress" == "true" ]]; then
        echo "🔍 Verifying backup: $(basename "$backup_file")"
        echo "   This may take a moment..."
        
        # Start progress indicator
        (
            local i=0
            while kill -0 $$ 2>/dev/null; do
                printf "\r   Verifying... %s" "${SPINNER_CHARS:$((i % 4)):1}"
                sleep 0.5
                ((i++))
            done
        ) &
        local progress_pid=$!
        
        # Perform verification
        local result=0
        if ! verify_backup_comprehensive "$backup_file" false; then
            result=1
        fi
        
        # Stop progress indicator
        kill $progress_pid 2>/dev/null || true
        wait $progress_pid 2>/dev/null || true
        printf "\r                                    \r"
        
        return $result
    else
        verify_backup_comprehensive "$backup_file" false
    fi
}

# Function to batch verify multiple backups
verify_backups_batch() {
    local backup_dir="$1"
    local pattern="${2:-*.gpg}"
    
    log_info "🔍 Batch verifying backups in: $backup_dir"
    log_info "   Pattern: $pattern"
    
    if [[ ! -d "$backup_dir" ]]; then
        log_warning "❌ Directory not found: $backup_dir"
        return 1
    fi
    
    local total_files=0
    local successful_files=0
    local failed_files=0
    
    # Count total files
    while IFS= read -r -d '' file; do
        ((total_files++))
    done < <(find "$backup_dir" -name "$pattern" -type f -print0 2>/dev/null)
    
    if [[ $total_files -eq 0 ]]; then
        log_info "   ℹ️  No backup files found matching pattern"
        return 0
    fi
    
    log_info "   📊 Found $total_files backup file(s) to verify"
    echo ""
    
    # Verify each file
    local current_file=0
    while IFS= read -r -d '' file; do
        ((current_file++))
        echo "[$current_file/$total_files] Verifying: $(basename "$file")"
        
        if verify_backup_comprehensive "$file" false; then
            echo "   ✅ PASSED"
            ((successful_files++))
        else
            echo "   ❌ FAILED"
            ((failed_files++))
        fi
        
        echo ""
    done < <(find "$backup_dir" -name "$pattern" -type f -print0 2>/dev/null)
    
    # Summary
    echo "🎯 Batch Verification Summary"
    echo "   Total files: $total_files"
    echo "   Successful: $successful_files"
    echo "   Failed: $failed_files"
    
    if [[ $failed_files -eq 0 ]]; then
        echo "   🎉 All backups verified successfully!"
        return 0
    else
        echo "   ⚠️  Some backups failed verification"
        return 1
    fi
}

# Function to create verification report
create_backup_report() {
    local backup_file="$1"
    local report_file="${2:-}"
    
    if [[ -z "$report_file" ]]; then
        report_file="${backup_file%.gpg}_verification_report.txt"
    fi
    
    log_info "📋 Creating verification report: $report_file"
    
    {
        echo "Backup Verification Report"
        echo "=========================="
        echo "Generated: $(date)"
        echo "Backup File: $backup_file"
        echo ""
        
        # File information
        echo "File Information:"
        echo "  Path: $(realpath "$backup_file")"
        echo "  Size: $(ls -lh "$backup_file" | awk '{print $5}')"
        echo "  Modified: $(ls -l "$backup_file" | awk '{print $6, $7, $8}')"
        
        # File type
        echo "  Type: $(file "$backup_file")"
        echo ""
        
        # Verification results
        echo "Verification Results:"
        if verify_backup_comprehensive "$backup_file" false; then
            echo "  Status: ✅ PASSED"
            echo "  Decryption: ✅ Successful"
            echo "  Content: ✅ Valid"
        else
            echo "  Status: ❌ FAILED"
            echo "  Decryption: ❌ Failed or Invalid"
        fi
        
        # Checksum if available
        if command -v generate_checksum &> /dev/null; then
            echo ""
            echo "Checksum Information:"
            if generate_checksum "$backup_file" >/dev/null; then
                echo "  SHA256: $checksum_result"
            else
                echo "  SHA256: Error generating checksum"
            fi
        fi
        
        echo ""
        echo "Report generated by KlickerUZH backup verification system"
        
    } > "$report_file"
    
    log_info "   📄 Report saved to: $report_file"
}

# =============================================================================
# CONSTANTS AND CONFIGURATION
# =============================================================================

# Spinner characters for progress indication
readonly SPINNER_CHARS="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

# =============================================================================
# SCRIPT METADATA
# =============================================================================

# Export functions that might be used externally
export -f format_file_size verify_backup_decrypt validate_backup_sample
export -f verify_backup_comprehensive verify_backup_with_progress
export -f verify_backups_batch create_backup_report

# Mark that this utility has been loaded
export BACKUP_VERIFY_LOADED=true

log_info "Backup verification utilities loaded successfully"