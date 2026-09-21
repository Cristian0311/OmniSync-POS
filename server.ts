import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Compatibilidad para ESM (dev) y CJS (prod)
const _dirname = typeof __dirname !== 'undefined' 
  ? __dirname 
  : path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Financial & Operational Report Analyzer
  app.post('/api/ai-analyze-report', async (req, res) => {
    try {
      const payload = req.body || {};
      const {
        businessName = 'MARÉ POS',
        dateFilterLabel = 'Todo el historial',
        baseCurrencyCode = 'CUP',
        baseCurrencySymbol = '$',
        kpis = {},
        topProducts = [],
        lowStockOrStagnant = [],
        cashSessionsDiscrepancies = [],
        currenciesSummary = []
      } = payload;

      const apiKey = process.env.GEMINI_API_KEY;

      let aiResult = null;

      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Analiza los siguientes datos financieros y operativos del negocio "${businessName}" (Filtro: ${dateFilterLabel}, Moneda base: ${baseCurrencyCode} ${baseCurrencySymbol}).
          
DATOS FINANCIEROS:
- Ventas Totales: ${kpis.totalSales || 0} ${baseCurrencyCode} (${kpis.salesCount || 0} transacciones)
- Ticket Promedio: ${kpis.avgTicket || 0} ${baseCurrencyCode}
- Entradas de Caja Extra: ${kpis.totalCashIncomes || 0}
- Egresos Operativos de Caja: ${kpis.totalCashExpenses || 0}
- Ingresos Bancarios (Transferencias/Depósitos): ${kpis.totalBankIncomes || 0}
- Egresos Bancarios: ${kpis.totalBankExpenses || 0}
- Flujo Neto Estimado: ${kpis.netFlow || 0} ${baseCurrencyCode}

TOP PRODUCTOS EN FACTURACIÓN:
${JSON.stringify(topProducts.slice(0, 6), null, 2)}

INVENTARIO ESTANCADO O BAJO STOCK:
${JSON.stringify(lowStockOrStagnant.slice(0, 6), null, 2)}

DESCUADRES Y ARQUEOS DE CAJA:
${JSON.stringify(cashSessionsDiscrepancies.slice(0, 6), null, 2)}

DESGLOSE POR MONEDA:
${JSON.stringify(currenciesSummary, null, 2)}

Genera un informe ejecutivo de auditoría contable y operativa con recomendaciones claras y datos estructurados para Excel. Responde ESTRICTAMENTE con un objeto JSON válido con esta estructura:
{
  "executiveSummary": "Un resumen ejecutivo conciso de 2-3 párrafos sobre la salud financiera y comercial del periodo.",
  "healthScore": 85,
  "topInsights": [
    "Insight 1 sobre rentabilidad y volumen",
    "Insight 2 sobre métodos de pago y transferencias",
    "Insight 3 sobre ticket promedio"
  ],
  "cashAlerts": [
    "Alerta 1 sobre arqueos de caja o cuadre",
    "Alerta 2 sobre control de efectivo vs transferencias"
  ],
  "inventoryAdvice": [
    "Consejo 1 sobre productos estrella vs estancados",
    "Consejo 2 sobre reposición y rotación de stock"
  ],
  "strategicActions": [
    "Acción prioritaria 1",
    "Acción prioritaria 2",
    "Acción prioritaria 3"
  ],
  "structuredAuditRows": [
    ["Área", "Métrica / Indicador", "Estado Actual", "Diagnóstico Operativo", "Acción Recomendada", "Prioridad"]
  ]
}`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              systemInstruction: 'Eres un consultor financiero y auditor contable senior especializado en retail, control de cajas POS y optimización de flujos de efectivo multimoneda.'
            }
          });

          if (response.text) {
            aiResult = JSON.parse(response.text);
          }
        } catch (geminiError) {
          console.warn('[AI Report] Gemini API call failed or timed out, falling back to smart heuristic audit:', geminiError);
        }
      }

      // If Gemini didn't run or failed, provide an intelligent rule-based audit
      if (!aiResult) {
        const sales = kpis.totalSales || 0;
        const netFlow = kpis.netFlow || 0;
        const txCount = kpis.salesCount || 0;
        const avgTicket = kpis.avgTicket || 0;
        const hasDifferences = cashSessionsDiscrepancies.some(d => Math.abs(d.discrepancy) > 1);

        const healthScore = Math.min(95, Math.max(50, 
          Math.round(75 + (sales > 0 ? 10 : 0) + (!hasDifferences ? 10 : -15))
        ));

        aiResult = {
          executiveSummary: `Durante el periodo auditado ("${dateFilterLabel}"), el negocio ${businessName} registró un volumen total facturado de ${sales.toLocaleString('es-CU')} ${baseCurrencyCode} en ${txCount} transacciones, con un ticket promedio de compra de ${avgTicket.toLocaleString('es-CU')} ${baseCurrencyCode}. El flujo neto operativo estimado se situó en ${netFlow.toLocaleString('es-CU')} ${baseCurrencyCode}. La diversificación de medios de pago entre efectivo y transferencias bancarias se mantiene activa, requiriendo supervisión constante sobre la confirmación de transferencias y la conciliación diaria de los arqueos de turno.`,
          healthScore,
          topInsights: [
            `Facturación global consolidada en ${sales.toLocaleString('es-CU')} ${baseCurrencyCode} con un promedio de ${avgTicket.toLocaleString('es-CU')} ${baseCurrencyCode} por venta.`,
            `El flujo neto operativo resultante es de ${netFlow.toLocaleString('es-CU')} ${baseCurrencyCode} tras descontar egresos operativos y pagos.`,
            currenciesSummary.length > 1 
              ? `Operación multimoneda activa en ${currenciesSummary.length} divisas, requiriendo control estricto de tasas de conversión.`
              : `Operación concentrada en ${baseCurrencyCode}, facilitando el cálculo directo de márgenes brutos.`
          ],
          cashAlerts: hasDifferences
            ? [
                `Se detectaron discrepancias en arqueos de caja en turnos cerrados. Se recomienda verificar los comprobantes físicos frente a los registros teóricos.`,
                `Asegurar que los egresos de caja por gastos operativos cuenten con recibo firmado y justificación contable.`
              ]
            : [
                `No se reportan discrepancias críticas en los arqueos de caja registrados en el periodo.`,
                `Mantener el protocolo de doble conteo al cambio de turno y registro inmediato de ingresos extraordinarios.`
              ],
          inventoryAdvice: [
            topProducts.length > 0 
              ? `El artículo líder "${topProducts[0]?.name}" representa un motor clave de ingresos; asegurar inventario de seguridad para evitar quiebres de stock.`
              : `Monitorear periódicamente los productos con mayor margen para incentivar promociones específicas.`,
            lowStockOrStagnant.length > 0
              ? `Se identificaron ${lowStockOrStagnant.length} productos con baja rotación o stock crítico que ameritan revisión comercial o descuento promocional.`
              : `Rotación de stock equilibrada según los registros de ventas del periodo.`
          ],
          strategicActions: [
            `Auditar periódicamente las conciliaciones entre el saldo bancario de Transfermóvil/EnZona y las ventas marcadas como "Transferencia".`,
            `Capacitar a los cajeros en el registro oportuno de vueltos mixtos y gastos menores de caja chica.`,
            `Ajustar los niveles de reorden en los productos estrella para maximizar el retorno sobre inventario.`
          ],
          structuredAuditRows: [
            ['Ventas y Facturación', 'Total Facturado', `${sales.toLocaleString('es-CU')} ${baseCurrencyCode}`, 'Rendimiento comercial conforme al registro de tickets', 'Mantener seguimiento de metas de ventas por turno', 'Alta'],
            ['Caja y Tesorería', 'Arqueos y Descuadres', hasDifferences ? 'Con discrepancias' : 'Cuadrado', hasDifferences ? 'Revisar cierres con diferencia negativa' : 'Auditoría de turnos limpia', 'Reforzar conciliación física al cierre', hasDifferences ? 'Urgente' : 'Media'],
            ['Cuentas Bancarias', 'Cobros por Transferencia', `${(kpis.totalBankIncomes || 0).toLocaleString('es-CU')} ${baseCurrencyCode}`, 'Pagos directos por canales digitales', 'Cruzar SMS y números de confirmación', 'Media'],
            ['Inventario y Catálogo', 'Artículos con Rotación', `${topProducts.length} productos activos`, 'Concentración de ingresos en referencias clave', 'Garantizar stock continuo de alta demanda', 'Alta'],
            ['Flujo Operativo', 'Flujo Neto Estimado', `${netFlow.toLocaleString('es-CU')} ${baseCurrencyCode}`, 'Margen operativo neto positivo del periodo', 'Optimizar control de gastos operativos de caja', 'Alta']
          ]
        };
      }

      // Sanitize and ensure complete valid structure
      const sanitizedResult = {
        executiveSummary: typeof aiResult?.executiveSummary === 'string' && aiResult.executiveSummary
          ? aiResult.executiveSummary 
          : `Auditoría contable y operativa para ${businessName}. Facturación registrada de ${(kpis?.totalSales || 0).toLocaleString('es-CU')} ${baseCurrencyCode}.`,
        healthScore: typeof aiResult?.healthScore === 'number' && !isNaN(aiResult.healthScore) 
          ? Math.max(1, Math.min(100, aiResult.healthScore)) 
          : 85,
        topInsights: Array.isArray(aiResult?.topInsights) 
          ? aiResult.topInsights.filter(Boolean) 
          : [`Facturación total registrada: ${(kpis?.totalSales || 0).toLocaleString('es-CU')} ${baseCurrencyCode}`],
        cashAlerts: Array.isArray(aiResult?.cashAlerts) 
          ? aiResult.cashAlerts.filter(Boolean) 
          : ['Verificar arqueos y comprobantes físicos de gastos operativos.'],
        inventoryAdvice: Array.isArray(aiResult?.inventoryAdvice) 
          ? aiResult.inventoryAdvice.filter(Boolean) 
          : ['Monitorear rotación de artículos de alta demanda.'],
        strategicActions: Array.isArray(aiResult?.strategicActions) 
          ? aiResult.strategicActions.filter(Boolean) 
          : ['Conciliar transferencias bancarias diariamente.'],
        structuredAuditRows: Array.isArray(aiResult?.structuredAuditRows) && aiResult.structuredAuditRows.length > 0
          ? aiResult.structuredAuditRows
          : [
              ['Ventas', 'Total Facturado', `${(kpis?.totalSales || 0).toLocaleString('es-CU')} ${baseCurrencyCode}`, 'Rendimiento comercial', 'Seguimiento continuo', 'Alta'],
              ['Caja', 'Control de Flujo', `${(kpis?.netFlow || 0).toLocaleString('es-CU')} ${baseCurrencyCode}`, 'Margen operativo neto', 'Optimizar egresos', 'Alta']
            ]
      };

      res.json({
        success: true,
        data: sanitizedResult
      });
    } catch (error: any) {
      console.error('[AI Report Error]', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al procesar el análisis con IA'
      });
    }
  });

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MARÉ POS Server] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
