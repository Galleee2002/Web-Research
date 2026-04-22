# PRD - Business Lead Finder (Sin Web)

## 1. Resumen

### 1.1 Overview

- **Nombre del producto:** Business Lead Finder
- **Tipo:** Web App (Dashboard + Data Pipeline)
- **Objetivo:** Detectar negocios locales que no poseen pagina web para generar oportunidades comerciales.

El sistema recolecta negocios por rubro y ubicacion, analiza si poseen sitio web, almacena la informacion y la presenta en un dashboard para gestion de leads.

### 1.2 Problema

Muchos negocios locales:

- No tienen presencia web.
- Solo usan redes sociales.
- Pierden oportunidades de venta.

Actualmente no existe una herramienta simple que:

- Detecte automaticamente estos negocios.
- Los centralice.
- Permita gestionarlos como leads.

### 1.3 Solucion

Una plataforma que:

- Busca negocios por categoria y ubicacion.
- Detecta si tienen sitio web.
- Guarda los datos en una base estructurada.
- Permite visualizarlos y gestionarlos desde un dashboard.

### 1.4 Usuario objetivo

- Freelancers / Developers
- Agencias digitales
- Vendedores B2B
- Emprendedores que venden servicios web

## 2. Alcance

### 2.1 Incluye (MVP)

- Busqueda de negocios por rubro + ciudad.
- Almacenamiento en DB.
- Deteccion de presencia web.
- Dashboard con listado de negocios.
- Filtro: sin web.
- Estados de lead.
- Exportacion a CSV.

### 2.2 No incluye (por ahora)

- Automatizacion de contacto (emails/whatsapp).
- IA scoring avanzado.
- Multiusuario.
- Integraciones CRM externas.

## 3. Flujo del sistema

1. Usuario crea una busqueda.
2. Backend consulta API de datos (Places / SERP).
3. Se obtienen negocios.
4. Se analiza si tienen web.
5. Se guardan en DB.
6. Frontend muestra resultados.
7. Usuario gestiona leads.

## 4. Requisitos funcionales

### 4.1 Busqueda de negocios

- **Input:**
	- `keyword` (ej: "dentistas")
	- `ubicacion` (ej: "Caballito")
- **Output:**
	- Lista de negocios.

### 4.2 Deteccion de sitio web

El sistema debe:

- Identificar si el negocio tiene website.
- Marcar `has_website = true/false`.

### 4.3 Almacenamiento

Cada negocio debe guardar:

- nombre
- categoria
- direccion
- ciudad
- telefono
- lat/lng
- website (nullable)
- estado del lead

### 4.4 Dashboard

El usuario debe poder:

- Ver lista de negocios.
- Filtrar por:
	- sin web
	- categoria
	- ubicacion
- Ordenar resultados.
- Paginar.

### 4.5 Gestion de leads

Estados posibles:

- `new`
- `reviewed`
- `contacted`
- `discarded`

El usuario debe poder cambiar estado manualmente.

### 4.6 Exportacion

- Exportar resultados a CSV.

## 5. Logica de negocio

### 5.1 Regla principal

Un negocio es considerado lead valido si:

- `website == null`
- `has_website = false`

### 5.2 Reglas secundarias

- Si solo tiene redes sociales, sigue siendo lead.
- Si `website` existe, excluir de leads principales.
- Evitar duplicados por: `nombre + direccion`.

## 6. Modelo de datos

### 6.1 Tabla `businesses`

- id
- external_id
- source
- name
- category
- address
- city
- lat
- lng
- phone
- website
- has_website
- google_maps_url
- created_at
- updated_at

### 6.2 Tabla `search_runs`

- id
- query
- location
- source
- total_found
- executed_at

### 6.3 Tabla `business_status`

- id
- business_id
- status
- notes
- updated_at

## 7. Arquitectura

### 7.1 Backend

- Python
- FastAPI
- SQLAlchemy

### 7.2 Data Pipeline

- Scripts Python
- Workers (futuro: Celery + Redis)

### 7.3 Base de datos

- PostgreSQL

### 7.4 Frontend

- React
- Tailwind CSS
- shadcn/ui

## 8. API Endpoints (MVP)

| Caso de uso | Metodo | Endpoint |
| --- | --- | --- |
| Buscar negocios | POST | `/search` |
| Obtener negocios | GET | `/businesses` |
| Filtrar sin web | GET | `/businesses?has_website=false` |
| Actualizar estado | PATCH | `/businesses/{id}/status` |
| Exportar CSV | GET | `/export` |

## 9. Metricas clave

- Cantidad de leads detectados.
- Porcentaje de negocios sin web.
- Leads contactados.
- Conversion (manual).

## 10. Riesgos

- Dependencia de APIs externas.
- Cambios en estructura de datos.
- Falsos positivos (negocios con web no detectada).
- Rate limits.

## 11. Roadmap

### 11.1 MVP

- Busqueda.
- Almacenamiento.
- Dashboard basico.
- Filtro sin web.

### 11.2 V2

- Deteccion de redes sociales.
- Scoring de leads.
- Enriquecimiento automatico.
- Deduplicacion avanzada.

### 11.3 V3

- CRM integrado.
- Automatizacion de outreach.
- Multiusuario.
- Analytics avanzado.

## 12. Testing

- Validacion de datos guardados.
- Evitar duplicados.
- Test de endpoints.
- Test de scraping/API ingestion.

## 13. Consideraciones legales

- No scrapear Google directamente.
- Usar APIs oficiales o proveedores intermedios.
- Respetar terminos de uso.

## 14. Definicion de exito (MVP)

El producto es exitoso si:

- Permite detectar negocios sin web.
- Muestra resultados correctamente.
- Permite gestionar leads.
- Funciona de punta a punta sin intervencion manual.

## 15. Notas finales

Este documento es la fuente unica de verdad del proyecto.
Cualquier cambio en logica, features o arquitectura debe reflejarse aca.