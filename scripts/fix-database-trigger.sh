#!/bin/bash

# Fix Database Trigger for Businesses Table
# This script fixes the column name mismatch in the update trigger

echo "🔧 Fixing businesses table trigger..."
echo ""

# Database connection details (use environment variables)
DB_HOST="${POSTGRES_HOST:-your-host.supabase.com}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-your_user}"
DB_NAME="${POSTGRES_DATABASE:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Migration file
MIGRATION_FILE="database/migrations/fix-businesses-trigger.sql"

echo "📋 Migration Details:"
echo "   File: $MIGRATION_FILE"
echo "   Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ ERROR: psql command not found"
    echo "   Please install PostgreSQL client tools"
    echo ""
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Apply the migration
echo "🚀 Applying migration..."
echo ""

PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Verifying trigger..."
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT tgname as trigger_name, proname as function_name FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid WHERE t.tgrelid = 'businesses'::regclass;"
else
    echo ""
    echo "❌ Migration failed!"
    echo "   Please check the error messages above"
    exit 1
fi

echo ""
echo "🎯 Next Steps:"
echo "   1. Restart your QuartzIQ server (npm run dev)"
echo "   2. Run a new extraction to test"
echo "   3. Businesses should now cache properly!"
