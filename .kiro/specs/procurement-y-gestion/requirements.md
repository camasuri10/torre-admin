# Requirements Document

## Módulo de Procurement y Gestión

## Introduction

El módulo de Procurement y Gestión es un sistema integral para la administración del ciclo de compras y contrataciones en TorreAdmin. Permite gestionar proveedores, crear y aprobar órdenes de compra, capturar cotizaciones (RFP/RFQ), configurar flujos de aprobación por montos y roles, generar documentos formales de órdenes y contratos, y monitorear la ejecución de contratos de proveedores.

Este módulo amplía la funcionalidad existente de gestión de proveedores (`proveedores`, `contratos_servicio`) con capacidades completas de procurement, incluyendo solicitud de cotizaciones, aprobación de órdenes, y generación de documentos legales.

## Glossary

- **Proveedor**: Entidad externa que provee bienes o servicios al edificio/conjunto
- **Contrato de Servicio**: Agreement formal entre el edificio y un proveedor (existente en tabla `contratos_servicio`)
- **Orden de Compra**: Documento formal que autoriza una compra o servicio específico
- **Cotización**: Respuesta de proveedor a una solicitud de propuesta (RFP) o presupuesto (RFQ)
- **RFP (Request for Proposal)**: Solicitud formal de propuesta para servicios o proyectos complejos
- **RFQ (Request for Quotation)**: Solicitud formal de presupuesto para bienes o servicios estandarizados
- **Flujo de Aprobación**: Conjunto de reglas que determinan quién aprueba cada orden según tipo y monto
- **Delegación de Aprobación**: Autorización otorgada a un usuario/rol para aprobar órdenes hasta cierto monto
- **Estado de Orden**: Ciclo de vida de una orden (borrador, pendiente_aprobacion, aprobada, rechazada, completada, cancelada)
- **Orden Activa**: Orden con estado diferente a cancelada, rechazada o completada
- **Usuario Aprobador**: Usuario con autoridad para aprobar órdenes según el flujo configurado
- **Monto de Delegación**: Valor máximo que un aprobador puede aprobar sin escalamiento
- **Documento de Orden**: Representación formal de la orden (PDF) para firmas y archivo
- **Contrato Generado**: Documento contractual basado en una orden aprobada y su proveedor
- **Sistema**: TorreAdmin (la aplicación completa)
- **Módulo de Procurement**: Componente del sistema que gestiona el ciclo de compras

## Requirements

### Requirement 1: Gestión de Contratos de Proveedores

**User Story:** Como administrador, quiero visualizar el estado de ejecución de los contratos de proveedores, para monitorear el cumplimiento de los servicios contratados.

#### Acceptance Criteria

1. THE Sistema SHALL display una lista de contratos de servicio asociados al edificio del usuario actual.
2. WHEN un usuario accede al módulo de procurement, THE Sistema SHALL mostrar el Dashboard de Contratos con resumen de: contratos activos, próximos a vencer, en ejecución, y valor total mensual.
3. THE Sistema SHALL permitir filtrar contratos por: proveedor, tipo de servicio, estado (activo/vencido/proximo_vencer), y fecha de vigencia.
4. THE Sistema SHALL mostrar indicadores visuales de estado de contrato: verde para activos, amarillo para próximos a vencer (30 días), rojo para vencidos.
5. THE Sistema SHALL calcular y mostrar el porcentaje de ejecución del contrato basado en: tiempo transcurrido vs duración total, y servicios completados vs contratados.
6. WHEN a contract is within 30 days of expiration, THE Sistema SHALL display una alerta de renovación en el Dashboard de Contratos.
7. THE Sistema SHALL allow exporting the contract list to PDF or Excel format.
8. THE Proveedor_Detail_Page SHALL display the complete contract history including: all active contracts, expired contracts, and total value contracted per provider.

---

### Requirement 2: Creación de Órdenes de Compra

**User Story:** Como administrador, quiero crear órdenes de compra/servicio para formalizar las solicitudes de bienes y servicios necesarios para el edificio.

#### Acceptance Criteria

1. THE Sistema SHALL provide a form to create new purchase orders with the following required fields: título, tipo (compra/servicio), proveedor, descripción, y monto estimado.
2. THE Sistema SHALL allow selecting an existing provider from the provider database.
3. THE Sistema SHALL allow creating a new provider directly from the order creation form.
4. THE Sistema SHALL automatically assign an order sequence number in format ORD-{EDIFICIO}-{AÑO}-{SECUENCIA}.
5. THE Sistema SHALL support the following order types: compra_bienes, servicio_mantenimiento, servicio_seguridad, servicio_aseo, obra civil, otro.
6. THE Sistema SHALL allow attaching files (quotes, requisitions, technical specifications) to the order.
7. THE Sistema SHALL set initial order status to "borrador" upon creation.
8. THE Sistema SHALL allow editing orders only when status is "borrador" or "rechazada".
9. WHEN an order exceeds the user's approval limit, THE Sistema SHALL automatically route it to the next approver according to the configured approval flow.
10. THE Sistema SHALL create an audit trail recording: creation date, creator user, all status changes, approval/rejection with user and timestamp.

---

### Requirement 3: Captura de Cotizaciones (RFP/RFQ)

**User Story:** Como administrador, quiero solicitar y capturar cotizaciones de múltiples proveedores para comparar precios y seleccionar la mejor opción.

#### Acceptance Criteria

1. THE Sistema SHALL allow creating two types of quotation requests: RFP (Request for Proposal) for complex services, and RFQ (Request for Quotation) for standard purchases.
2. THE Solicitud_Cotizacion SHALL include: título, tipo (RFP/RFQ), descripción detallada, fecha límite de respuesta, criterios de evaluación, y documentos adjuntos.
3. THE Sistema SHALL allow sending quotation requests to multiple selected providers simultaneously.
4. WHEN a quotation request is sent, THE Sistema SHALL notify providers via email with access link to submit their proposal.
5. THE Proveedor_Quote_Form SHALL allow providers to submit: precio, condiciones de pago, tiempo de entrega, vigencia de la cotización, y comentarios adicionales.
6. THE Sistema SHALL capture quotation responses and store them linked to the original request.
7. THE Sistema SHALL allow comparing quotations side-by-side with columns for each provider and rows for each evaluation criterion.
8. THE Sistema SHALL allow marking a quotation as "ganadora" and automatically create a purchase order from it.
9. THE Sistema SHALL close quotation requests after the deadline or when manually marked as closed.
10. THE Sistema SHALL track quotation metrics: number of requests sent, response rate, average response time.

---

### Requirement 4: Configuración de Flujos de Compra

**User Story:** Como super administrador, quiero configurar quién aprueba cada tipo de orden y los montos de delegación por rol/usuario.

#### Acceptance Criteria

1. THE Sistema SHALL provide a configuration interface to define approval flows by: order type, order value range, and user/role.
2. THE Flujo_Configuracion SHALL support defining approval chains with multiple levels (Level 1, Level 2, Level 3).
3. THE Sistema SHALL allow assigning approvers by: specific user, role (administrador, backoffice), or delegation group.
4. THE Sistema SHALL configure monetary delegation limits per approver: users can only approve orders up to their defined limit without escalation.
5. THE Sistema SHALL define default approval rules when no specific configuration exists: orders under $1,000,000 COP require administrador approval, orders over $1,000,000 COP require two-level approval.
6. THE Sistema SHALL allow configuring escalation rules: WHEN an order exceeds the approver's limit, THEN it shall automatically escalate to the next level.
7. THE Sistema SHALL support time-based approvals: WHEN an approver does not respond within the configured time limit (default 48 hours), THEN the order shall automatically escalate.
8. THE Sistema SHALL allow configuring notification preferences for approvers: email, in-app, or both.
9. THE Sistema SHALL store all approval flow configurations with version history for audit purposes.
10. THE Sistema SHALL provide a test/validation view showing which approver would handle a sample order given its type and amount.

---

### Requirement 5: Aprobación de Órdenes

**User Story:** Como aprobador, quiero recibir, revisar y aprobar o rechazar órdenes de compra según los flujos configurados.

#### Acceptance Criteria

1. THE Sistema SHALL display a pending approvals queue showing all orders awaiting the current user's approval.
2. THE Orden_Detail SHALL show complete information: description, attached documents, quoted prices, requester details, and approval history.
3. THE Sistema SHALL allow approvers to approve orders within their delegation limit.
4. THE Sistema SHALL prevent approvers from approving orders exceeding their limit, displaying a clear error message.
5. WHEN an order is approved, THE Sistema SHALL update the status to "aprobada" and notify the requester.
6. THE Sistema SHALL allow approvers to reject orders with a mandatory reason/comment.
7. WHEN an order is rejected, THE Sistema SHALL update the status to "rechazada", notify the requester, and allow them to modify and resubmit.
8. THE Sistema SHALL support bulk approval for multiple orders of the same type/value range.
9. THE Sistema SHALL generate email notifications to approvers when new orders require their approval.
10. THE Sistema SHALL display approval statistics: total approved, rejected, average approval time, and pending volume.

---

### Requirement 6: Generación de Órdenes de Compra

**User Story:** Como administrador, quiero generar documentos formales de órdenes de compra para firma y archivo legal.

#### Acceptance Criteria

1. THE Sistema SHALL generate a formal purchase order document in PDF format.
2. THE Orden_Document SHALL include: order number, date, requester name, provider details, description of goods/services, quantities, unit prices, total amount, payment terms, delivery terms, and approval signatures.
3. THE Sistema SHALL support digital signatures: WHEN an order is approved, THEN the approver's name and timestamp shall be included as digital signature.
4. THE Sistema SHALL allow printing the purchase order for physical signature if required.
5. THE Sistema SHALL maintain a document history showing all generated versions of the order.
6. THE Sistema SHALL generate a unique QR code on each order document for verification.
7. THE Sistema SHALL allow downloading individual orders or batch downloading multiple orders.
8. THE Sistema SHALL store generated PDF documents linked to the order record.

---

### Requirement 7: Generación de Contratos

**User Story:** Como administrador, quiero generar contratos formales basados en las órdenes aprobadas y los proveedores seleccionados.

#### Acceptance Criteria

1. THE Sistema SHALL generate formal contracts in PDF format based on approved purchase orders.
2. THE Contrato_Generado SHALL include: contract number, date, parties (building/provider), scope of work, deliverables, timeline, payment schedule, total value, terms and conditions, and signature blocks.
3. THE Sistema SHALL allow selecting a contract template from pre-defined templates: servicio_mantenimiento, obra_civil, suministro_bienes, consultoria.
4. THE Sistema SHALL automatically populate contract fields from the associated purchase order and provider data.
5. THE Sistema SHALL allow customizing contract terms before generation.
6. THE Sistema SHALL link generated contracts to both the purchase order and the provider's contract history.
7. THE Sistema SHALL support digital signatures on generated contracts.
8. THE Sistema SHALL track contract status: borrador, pendiente_firma, firmado, activo, completado, vencido.
9. THE Sistema SHALL generate contract renewal reminders at 60, 30, and 15 days before expiration.
10. THE Sistema SHALL allow converting an approved order directly into a formal service contract.

---

### Requirement 8: Modelos de Datos

**User Story:** Como desarrollador, necesito los modelos de datos completos para implementar el módulo de procurement.

#### Acceptance Criteria

1. THE Database SHALL include an ordenes_compra table with fields: id, numero_orden, titulo, tipo_orden, proveedor_id, descripcion, monto_estimado, monto_final, estado, fecha_necesidad, edificio_id, conjunto_id, solicitante_id, created_at, updated_at.
2. THE Database SHALL include an orden_items table for line items: id, orden_id, descripcion, cantidad, unidad_medida, precio_unitario, subtotal.
3. THE Database SHALL include a cotizaciones table: id, orden_id, proveedor_id, numero_cotizacion, fecha_recepcion, monto, condiciones_pago, tiempo_entrega, vigencia, estado (recibida/ganadora/perdedora), observaciones.
4. THE Database SHALL include a solicitudes_cotizacion table: id, titulo, tipo (RFP/RFQ), descripcion, fecha_limite, criterios_evaluacion, estado, edificio_id, created_by.
5. THE Database SHALL include a cotizacion_respuestas table: id, solicitud_id, proveedor_id, propuesta_tecnica, propuesta_economica, fecha_envio, archivos_adjuntos.
6. THE Database SHALL include a flujos_aprobacion table: id, nombre, tipo_orden, monto_minimo, monto_maximo, nivel, approver_id, approver_rol, edificio_id, conjunto_id, activo.
7. THE Database SHALL include a delegacion_usuario table: id, usuario_id, monto_maximo, tipo_ordenes (array), activo, fecha_inicio, fecha_fin.
8. THE Database SHALL include an orden_aprobaciones table: id, orden_id, approver_id, nivel, estado (pendiente/aprobada/rechazada), comentario, fecha_decision.
9. THE Database SHALL include a documentos_orden table: id, orden_id, tipo (orden_pdf/contrato_pdf), url_archivo, version, generado_por, created_at.
10. THE Database SHALL include a contratos_generados table: id, numero_contrato, orden_id, proveedor_id, template, fecha_inicio, fecha_fin, valor_total, estado, archivo_url.
11. THE Sistema SHALL create foreign key relationships between ordenes_compra and proveedores, cotizaciones and proveedores, contratos_generados and proveedores.
12. THE Sistema SHALL add indexes on commonly queried fields: ordenes_compra (estado, proveedor_id, created_at), cotizaciones (orden_id, proveedor_id), flujos_aprobacion (edificio_id, tipo_orden).

---

### Requirement 9: Integración con Módulos del Sistema

**User Story:** Como administrador, quiero que el módulo de procurement se integre naturalmente con los módulos existentes de TorreAdmin.

#### Acceptance Criteria

1. THE Sistema SHALL add "procurement" to the available modules list in the modulos table.
2. THE Sistema SHALL display the procurement module in the sidebar navigation following the existing module structure pattern (/dashboard/procurement/page.tsx).
3. THE Sistema SHALL restrict access to procurement module based on user role: only superadmin, administrador, and backoffice roles shall have access.
4. THE Sistema SHALL link procurement to existing proveedor data: the new ordenes_compra table shall reference the existing proveedores table.
5. THE Sistema SHALL integrate with the existing authentication system: all procurement endpoints shall require valid JWT authentication.
6. THE Sistema SHALL use the existing API router pattern: new router file at /api/routers/procurement.py.
7. THE Sistema SHALL inherit the building/conjunto context from the user's session for filtering data appropriately.
8. THE Sistema SHALL allow enabling/disabling the procurement module per building through the existing edificio_modulos configuration.
9. THE Sistema SHALL integrate with the notifications system for approval alerts and status changes.

---

### Requirement 10: Roles y Permisos

**User Story:** Como administrador de seguridad, quiero definir qué acciones puede realizar cada rol en el módulo de procurement.

#### Acceptance Criteria

1. THE Sistema SHALL define the following permission matrix:
   - **superadmin**: create_orders, approve_orders, configure_flows, view_all_orders, manage_providers, generate_documents, view_reports
   - **administrador**: create_orders, approve_orders (within limit), view_orders, view_providers, generate_documents
   - **backoffice**: create_orders, view_orders, view_providers, generate_documents (read-only approval)
   - **servicios/portero/propietario/inquilino**: no access to procurement module
2. THE Sistema SHALL validate permissions on every procurement API endpoint.
3. THE Sistema SHALL hide UI elements (buttons, links) based on user permissions.
4. THE Sistema SHALL log all permission denied attempts for security audit.
5. THE Sistema SHALL support role-based delegation: administrators can temporarily delegate their approval authority to another user.

---

### Requirement 11: Estados de Órdenes

**User Story:** Como sistema, necesito gestionar el ciclo de vida completo de las órdenes de compra.

#### Acceptance Criteria

1. THE Sistema SHALL support the following order states: borrador, pendiente_aprobacion, aprobada, rechazada, en_ejecucion, completada, cancelada.
2. THE Sistema SHALL define valid state transitions:
   - borrador → pendiente_aprobacion (on submit)
   - pendiente_aprobacion → aprobada (on approval)
   - pendiente_aprobacion → rechazada (on rejection)
   - aprobada → en_ejecucion (on start)
   - en_ejecucion → completada (on completion)
   - Any state → cancelada (on cancellation, with reason)
   - rechazada → borrador (on edit and resubmit)
3. THE Sistema SHALL prevent invalid state transitions with appropriate error messages.
4. THE Sistema SHALL record the timestamp and user for each state change.
5. THE Sistema SHALL allow viewing the complete state history of any order.

---

### Requirement 12: Flujo de Aprobación por Montos

**User Story:** Como sistema, necesito asegurar que las órdenes se aprueben según las reglas de monto configuradas.

#### Acceptance Criteria

1. THE Sistema SHALL evaluate the approval flow when an order is submitted.
2. THE Sistema SHALL determine the initial approver based on: order type, order amount, and configured approval rules.
3. WHEN order amount <= approver's delegation limit, THE Sistema SHALL assign the order to the user's direct approver.
4. WHEN order amount > approver's delegation limit, THE Sistema SHALL automatically escalate to the next approval level.
5. THE Sistema SHALL support parallel approval: orders above certain threshold (configurable, default $5,000,000 COP) require approval from multiple approvers.
6. THE Sistema SHALL require final approval from superadmin for orders exceeding $50,000,000 COP.
7. THE Sistema SHALL display a clear indication of the approval path and current status in the order detail view.
8. THE Sistema SHALL send notifications to all relevant approvers when an order enters their queue.
9. THE Sistema SHALL handle approval timeout: orders not acted upon within 72 hours shall trigger escalation reminders.

---

### Requirement 13: Reportes y Métricas

**User Story:** Como administrador, quiero visualizar reportes y métricas del módulo de procurement para tomar decisiones informadas.

#### Acceptance Criteria

1. THE Sistema SHALL generate a procurement dashboard with: total orders by status, total spend by category, average approval time, top suppliers by order volume.
2. THE Sistema SHALL allow filtering reports by: date range, order type, provider, status, building.
3. THE Sistema SHALL display a spend analysis chart showing monthly procurement spending trends.
4. THE Sistema SHALL generate a supplier performance report showing: number of orders, on-time delivery rate, quality ratings (if configured).
5. THE Sistema SHALL allow exporting reports to PDF and Excel formats.
6. THE Sistema SHALL display key KPIs: average order processing time, approval rate, rejection rate, cost savings from competitive quotes.

---

### Requirement 14: Notificaciones

**User Story:** Como usuario, quiero recibir notificaciones sobre eventos importantes en el flujo de procurement.

#### Acceptance Criteria

1. THE Sistema SHALL send email notifications to: order requesters (on approval/rejection), approvers (new orders pending), providers (new quotation requests).
2. THE Sistema SHALL display in-app notifications for: pending approvals, order status changes, contract expiration reminders.
3. THE Sistema SHALL allow users to configure their notification preferences: email, in-app, both, or none.
4. THE Sistema SHALL batch email notifications to avoid excessive emails (digest option).
5. THE Sistema SHALL include actionable links in notifications that direct users to the relevant order or approval.

---

### Requirement 15: Auditoría y Logs

**User Story:** Como auditor, quiero un registro completo de todas las acciones en el módulo de procurement.

#### Acceptance Criteria

1. THE Sistema SHALL log all critical actions: order creation, submission, approval, rejection, modification, document generation.
2. THE Audit_Log SHALL record: timestamp, user_id, action_type, entity_type, entity_id, old_value (if applicable), new_value (if applicable), IP address.
3. THE Sistema SHALL maintain audit logs for a minimum of 5 years.
4. THE Sistema SHALL allow administrators to search and filter audit logs.
5. THE Sistema SHALL generate audit reports for compliance purposes.