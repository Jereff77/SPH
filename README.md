# SPH

Repositorio central para los proyectos de SPH. Este repositorio se usa como contenedor de varios proyectos, pero cada proyecto vive en una rama distinta. La rama `main` solo contiene documentación.

## Ramas de proyecto

- `app-qr`
- `cfdis`
- `CRMVentas`
- `ERP-RLS`
- `QR-RLS`

Cada una de estas ramas representa un proyecto diferente. No se mezclan entre sí ni se fusionan a `main`.

## Cómo clonar solo el proyecto que te corresponde

Cuando vayas a trabajar en un proyecto, clona directamente la rama correspondiente usando `--single-branch`:

### app-qr

```bash
git clone --single-branch --branch app-qr https://github.com/Jereff77/SPH
```

### cfdis

```bash
git clone --single-branch --branch cfdis https://github.com/Jereff77/SPH
```

### CRMVentas

CRM de Ventas para SPH Bienes Raíces - sistema de seguimiento de prospectos, leads y pipeline comercial. Incluye Report Studio, un constructor visual de reportes y dashboards con drag & drop.

```bash
git clone --single-branch --branch CRMVentas https://github.com/Jereff77/SPH
```

### ERP-RLS

```bash
git clone --single-branch --branch ERP-RLS https://github.com/Jereff77/SPH
```

### QR-RLS

```bash
git clone --single-branch --branch QR-RLS https://github.com/Jereff77/SPH
```

Sustituye `<URL-DEL-REPO>` por la URL HTTPS o SSH del repositorio en GitHub.

## Flujo de trabajo dentro de cada proyecto

1. Sitúate en la rama del proyecto:

   ```bash
   git checkout app-qr
   ```

2. Crea ramas de trabajo (features/fixes) a partir de esa rama, por ejemplo:

   ```bash
   git checkout -b app-qr/feature-nombre-de-la-feature
   ```

3. Trabaja, haz commits y sube tu rama:

   ```bash
   git add .
   git commit -m "Descripción del cambio"
   git push -u origin app-qr/feature-nombre-de-la-feature
   ```

4. Cuando termines, fusiona la rama de feature de vuelta a la rama del proyecto (`app-qr`, `cfdis`, `ERP-RLS` o `QR-RLS`), nunca a `main`.

## Uso de main

- `main` solo se usa para documentación y coordinación general.
- No se debe desarrollar código directamente en `main`.
- No se hacen merges desde las ramas de proyecto hacia `main`.
