#!/usr/bin/env python3
"""
Test para procesar el formato exacto de correos de depósito con tabulaciones
"""

import re
from datetime import datetime

def test_deposit_extraction():
    """Procesa un correo de depósito con formato exacto"""

    # Simular el correo exacto que recibes
    email_body = """
Transferencia Interbancaria SPEI
Fecha de Operación:		12-Dic-2025
Hora de Operación:		11:11:24 horas
Cuenta Destino:		********8480-CUENTA CONECTA BANBAJÍO-1
Nombre del Ordenante:		PLANTAS MEDICINALES ANAHUACSA DE CV
Banco Emisor:		BBVA MEXICO
Importe:		$ 54,871.04 MN
Concepto de Pago:		GRUPO SPH 9532
Clave de Rastreo:		BNET01002512150049564834
"""

    print("PROBANDO EXTRACCION DE DATOS CON FORMATO REAL")
    print("=" * 50)

    # Datos extraídos
    deposit_info = {
        'idmov': f"test-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        'fc': datetime.now().isoformat(),
        'asunto': 'TEST - Instrucción de depósito a tu cuenta',
        'fecOperacion': None,
        'horaOperacion': None,
        'ordenante': None,
        'ctaDestino': None,
        'bcoDestino': None,
        'beneficiario': 'GRUPO SPH SA DE CV',
        'importe': None,
        'cancepto': None,
        'referencia': None,
        'rastreo': None,
        'autorizacion': None,
        'bancoEmisor': None,
        'tipo': 'Depósito',
        'aplicado': False,
        'manual': False,
        'Operacion': 'Transferencia Interbancaria SPEI'
    }

    # Fecha de Operación
    fecha_match = re.search(r'Fecha de Operación:\s*(\d{2}-[A-Za-z]{3}-\d{4})', email_body)
    if fecha_match:
        fecha_str = fecha_match.group(1)
        meses = {'Ene': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Abr': 'Apr',
                'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Ago': 'Aug',
                'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dic': 'Dec'}
        for mes_es, mes_en in meses.items():
            fecha_str = fecha_str.replace(mes_es, mes_en)
        try:
            fecha_dt = datetime.strptime(fecha_str, '%d-%b-%Y')
            deposit_info['fecOperacion'] = fecha_dt.strftime('%Y-%m-%d')
            print(f"Fecha extraida: {deposit_info['fecOperacion']}")
        except:
            print(f"❌ Error parseando fecha: {fecha_str}")

    # Hora de Operación
    hora_match = re.search(r'Hora de Operación:\s*(\d{2}:\d{2}:\d{2})\s*horas', email_body)
    if hora_match:
        deposit_info['horaOperacion'] = hora_match.group(1)
        print(f"Hora extraida: {deposit_info['horaOperacion']}")

    # Cuenta Destino - PATRÓN CON TABULACIONES
    cuenta_match = re.search(r'Cuenta Destino:\t+([^\n\r\t]+)', email_body, re.IGNORECASE)
    if cuenta_match:
        deposit_info['ctaDestino'] = cuenta_match.group(1).strip()
        print(f"Cuenta destino extraida: {deposit_info['ctaDestino']}")
    else:
        print("X No se encontro cuenta destino")

    # Nombre del Ordenante - PATRÓN CON TABULACIONES
    ordenante_match = re.search(r'Nombre del Ordenante:\t+([^\n\r\t]+)', email_body, re.IGNORECASE)
    if ordenante_match:
        deposit_info['ordenante'] = ordenante_match.group(1).strip()
        print(f"Ordenante extraido: {deposit_info['ordenante']}")
    else:
        print("X No se encontro ordenante")

    # Banco Emisor - PATRÓN CON TABULACIONES
    banco_match = re.search(r'Banco Emisor:\t+([^\n\r\t]+)', email_body, re.IGNORECASE)
    if banco_match:
        deposit_info['bancoEmisor'] = banco_match.group(1).strip()
        print(f"Banco emisor extraido: {deposit_info['bancoEmisor']}")
    else:
        print("X No se encontro banco emisor")

    # Importe - PATRÓN CON TABULACIONES
    importe_match = re.search(r'Importe:\t+\$\s*([\d,]+\.\d{2})\s*MN', email_body, re.IGNORECASE)
    if importe_match:
        importe_str = importe_match.group(1).replace(',', '')
        try:
            deposit_info['importe'] = float(importe_str)
            print(f"Importe extraido: ${deposit_info['importe']:,.2f}")
        except:
            print(f"X Error convirtiendo importe: {importe_str}")
    else:
        print("X No se encontro importe")

    # Concepto de Pago - PATRÓN CON TABULACIONES
    concepto_match = re.search(r'Concepto de Pago:\t+([^\n\r\t]+)', email_body, re.IGNORECASE)
    if concepto_match:
        deposit_info['cancepto'] = concepto_match.group(1).strip()
        print(f"Concepto extraido: {deposit_info['cancepto']}")
    else:
        print("X No se encontro concepto")

    # Clave de Rastreo - PATRÓN CON TABULACIONES
    rastreo_match = re.search(r'Clave de Rastreo:\t+([A-Z0-9]+)', email_body, re.IGNORECASE)
    if rastreo_match:
        rastreo_value = rastreo_match.group(1).strip()
        if len(rastreo_value) >= 10:
            deposit_info['rastreo'] = rastreo_value
            print(f"Clave de rastreo extraida: {rastreo_value}")
        else:
            print(f"X Clave de rastreo invalida: {rastreo_value}")
    else:
        print("X No se encontro clave de rastreo")

    print("\n" + "=" * 50)
    print("RESUMEN DE DATOS EXTRAIDOS")
    print("=" * 50)

    # Verificar campos críticos
    campos_criticos = ['rastreo', 'ordenante', 'ctaDestino', 'importe', 'bancoEmisor']
    exitos = 0

    for campo in campos_criticos:
        if deposit_info.get(campo):
            print(f"+ {campo}: {deposit_info[campo]}")
            exitos += 1
        else:
            print(f"- {campo}: NO EXTRAIDO")

    print(f"\nEXITO: {exitos}/{len(campos_criticos)} campos criticos extraidos")

    if exitos == len(campos_criticos):
        print("TODOS LOS CAMPOS EXTRAIDOS CORRECTAMENTE!")
        print("El sistema esta listo para procesar correos reales")
    else:
        print("Faltan campos por extraer - necesita ajustes")

    return deposit_info

if __name__ == "__main__":
    test_deposit_extraction()