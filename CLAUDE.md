# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sistema automatizado para procesar dos tipos de correos electrónicos:
1. **Facturas XML**: Correos con archivos XML de facturas CFDI (Comprobante Fiscal Digital por Internet) mexicanas
2. **Notificaciones Bancarias**: Correos de transferencias bancarias (dominios @bb.com.mx y @bb.com)

El sistema se conecta a un servidor IMAP de Hostinger, clasifica los correos por remitente, extrae la información relevante y la almacena en una base de datos Supabase. Las facturas XML se procesan completamente, mientras que las notificaciones bancarias se identifican pero no se marcan como leídas.

## Environment Setup

### Required Environment Variables (.env file)

```env
# Configuración de correo IMAP
IMAP_SERVER=imap.hostinger.com
IMAP_PORT=993
IMAP_USER=tu_correo@dominio.com
IMAP_PASSWORD=tu_contraseña

# Configuración de Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_api

# Configuración del procesador
POLLING_INTERVAL=60
LOG_LEVEL=INFO
```

### Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

## Common Commands

### Running the System

```bash
# Run in continuous mode (monitors emails every 60 seconds)
python main.py

# Run once and exit
python main.py --mode once

# Test connections without processing
python main.py --test

# Show system status
python main.py --status
```

### Testing

```bash
# Run simple system tests
python test_simple.py

# Run complete system tests
python test_system.py

# Run demo processing
python demo_procesamiento.py
```

## Architecture

### Core Processing Flow

#### For Invoice Emails:
1. **EmailClient** connects to Hostinger IMAP server and retrieves unread emails
2. **EmailClassifier** identifies email type by sender domain
3. **XMLParser** extracts and parses XML attachments (CFDI files)
4. **FacturaMapper** maps XML data to the `catFacturas` table structure
5. **SupabaseClient** inserts data into Supabase (checking for duplicates by UUID)
6. Email is marked as read and the cycle repeats

#### For Bank Emails:
1. **EmailClient** connects to Hostinger IMAP server and retrieves unread emails
2. **EmailClassifier** identifies bank emails by domain (@bb.com.mx, @bb.com)
3. **BankProcessor** identifies and logs bank transfer notifications
4. **IMPORTANT**: Bank emails are NOT marked as read (remain in inbox for manual review)
5. System continues to next cycle

### Module Responsibilities

- **config.py**: Loads environment variables and validates configuration
- **email_client.py**: IMAP connection, email retrieval, XML attachment extraction, email type classification
- **xml_parser.py**: Parses CFDI XML files with Mexican tax namespaces
- **factura_mapper.py**: Maps XML data to database schema with data cleaning and validation
- **processor.py**: Orchestrates the entire processing pipeline for both email types
- **supabase_client.py**: Database operations with duplicate detection
- **bank_processor.py**: Handles bank email processing (placeholder for future transfer extraction)
- **logger.py**: Centralized logging system with file and console outputs

### CFDI XML Structure

The system processes Mexican CFDI 4.0 XML files with these namespaces:
- `cfdi`: http://www.sat.gob.mx/cfd/4
- `tfd`: http://www.sat.gob.mx/TimbreFiscalDigital

Key elements extracted:
- **Comprobante**: Invoice header (folio, date, totals, currency)
- **Emisor**: Issuer information (RFC, name, tax regime)
- **Receptor**: Recipient information
- **Conceptos**: Line items
- **TimbreFiscalDigital**: Tax stamp with UUID (used as primary key)

### Database Schema

The `catFacturas` table includes:
- **uuidCFDI**: UUID from tax stamp (unique identifier, used for duplicate detection)
- **idFactura**: Same as uuidCFDI (primary key)
- **folioCFDI**, **fecCFDI**, **totalCFDI**, **subtotalCFDI**: Basic invoice data
- **rfcEmisor**, **nombreEmisor**, **regimenFiscal**: Issuer data
- **mesFactura**, **anioCFDI**: Derived from fecCFDI for reporting
- **descripcion**: Auto-generated markdown summary
- **concepto**: Primary line item description
- **status**, **aplicada**, **manual**: Status flags

## Development Guidelines

### Working with CFDI XML

- CFDI XMLs require proper namespace handling - always use `NAMESPACES` dict in XMLParser
- Dates in CFDI use ISO 8601 format with potential timezone info
- The `TimbreFiscalDigital` may be in different locations - search within `Complementos` first
- UUID from `TimbreFiscalDigital` is the authoritative unique identifier

### Data Validation

- **Required fields**: `idFactura` and `uuidCFDI` must be present before insertion
- All text fields are stripped and cleaned
- Numeric fields default to 0 if missing
- Dates default to current datetime if missing for fecCFDI
- `concepto` field cannot be empty (defaults to "Sin descripción")

### Error Handling

- Processing errors for individual emails should not stop the entire pipeline
- Connection failures trigger automatic reconnection attempts
- All errors are logged with context
- Emails are marked as read even if processing fails (to avoid infinite loops)

### Logging

Logs are written to:
- Console: Real-time output
- File: `logs/facturas_YYYYMMDD.log`

Use appropriate log levels:
- `DEBUG`: Detailed parsing/connection info
- `INFO`: Processing milestones
- `WARNING`: Recoverable issues
- `ERROR`: Processing failures
- `CRITICAL`: System-level failures

### Email Type Classification

The system automatically classifies emails based on sender domain:

**Bank Email Domains** (processed but NOT marked as read):
- `@bb.com.mx`
- `@bb.com`

**Invoice Emails** (processed and marked as read):
- All other emails with XML attachments

### Testing Approach

Before making changes:
1. Run `python main.py --test` to verify connections
2. Test with `python main.py --mode once` for single execution
3. Run full system tests with `test_system.py`
4. Check logs for bank email identification: `grep "Correo bancario" logs/facturas_YYYYMMDD.log`

### Adding New Fields

When adding fields to extract from CFDI:
1. Add extraction logic in `XMLParser._extract_*_data()` methods
2. Add mapping in `FacturaMapper.map_to_catfacturas()`
3. Add validation in `FacturaMapper._clean_and_validate_data()`
4. Update database schema in Supabase
5. Update the descripción generation if the field is important

### Performance Considerations

- The system processes emails sequentially to maintain data integrity
- `POLLING_INTERVAL` controls frequency - default 60 seconds
- No parallel processing of emails to avoid race conditions
- Connection pooling is handled by supabase-py client

## Common Issues

### IMAP Connection Failures
- Verify IMAP is enabled in Hostinger account
- Check firewall/network restrictions
- Confirm credentials are correct

### XML Parsing Failures
- CFDI version mismatches (system expects CFDI 4.0)
- Invalid/corrupted XML files
- Missing TimbreFiscalDigital element

### Duplicate UUID Errors
- Expected behavior - system detects and skips duplicate invoices
- Check logs to confirm it's not a mapping error

### Supabase Insertion Failures
- Verify table permissions (SELECT, INSERT required)
- Check API key has correct access level
- Validate data types match schema

## Project Context

This system is built for SPH Bines Raices to automate processing of two types of emails from Recaudación de Activos (RA):

1. **Invoice Processing**: Invoices arrive via email as CFDI XML attachments and are stored in a structured format for accounting and reporting purposes.

2. **Bank Transfer Notifications**: Transfer notifications arrive from BBVA bank domains and need to be identified for manual review and processing (currently logged but not automatically processed).

The system intelligently distinguishes between these email types and applies appropriate processing rules.
