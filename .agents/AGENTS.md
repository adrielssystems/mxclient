# MXCLIENT (Client Portal) - Workspace Rules & Directives

## 1. LEY INNEGOCIABLE: VERIFICACIÓN DEL ESQUEMA DE BASE DE DATOS
**ANTES** de programar o modificar cualquier funcionalidad que involucre el flujo de datos (consultas SQL, rutas de API, o mapeos de propiedades en componentes JSX/React), **TIENES LA OBLIGACIÓN ABSOLUTA de verificar el esquema real de la base de datos** para tener total certeza del **nombre verdadero de las tablas y sus columnas exactas**.

### Reglas de Obligatoria Cumplimentación:
1. **Nunca Adivines ni Supongas Nombres**: Está rotundamente prohibido inventar o asumir nombres de tablas o columnas sin comprobación previa. No asumas simetrías verbales entre módulos o interfaces (por ejemplo: asumir campos como `mailing_in_tracking` o `date_mailed_out` cuando en la base de datos los campos son en realidad `tracking_in`, `tracking_out`, `date_received` y `date_mailed` provenientes de la tabla `title_logs`).
2. **Sincronía entre Panel Admin y Portal Cliente**: Siempre que reflejes datos en MXCLIENT que fueron originados o configurados desde Appmx2 (Panel Administrativo), asegúrate de haber revisado las tablas y queries en el Admin Panel para no consultar tablas de servicios secundarias vacías (ej: `vehicle_title_services`) en lugar de las tablas maestras logísticas (`title_logs`, `dispatch_orders`, etc.).
3. **Mecanismo de Comprobación**: Realiza búsquedas precisas en el backend con `grep_search` o realiza consultas exploratorias al catálogo de PostgreSQL (ej: `information_schema.columns`) para validar que las columnas existan y contengan el dato esperado.
