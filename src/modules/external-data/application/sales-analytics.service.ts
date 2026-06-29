import { Injectable, Logger } from '@nestjs/common';
import { SalesDataService } from '../../external-data/application/sales-data.service';
import { SalesRecord } from '../../external-data/domain/sales.types';

export interface PerformanceComparison {
  model: string;
  brand: string;
  sales3Months2026: number;
  sales3Months2025: number;
  june2025: number;
  growthRate: number; // Percent difference between the two 3-month periods
  suggestedGoal2026: number;
}

@Injectable()
export class SalesAnalyticsService {
  private readonly logger = new Logger(SalesAnalyticsService.name);

  constructor(private readonly salesDataService: SalesDataService) {}

  /**
   * Orchestrates the retrieval of past metrics and calculates performance/targets
   */
  async generateStrategyMetrics(year: number, month: number): Promise<{
    raw2026: SalesRecord[][];
    raw2025: SalesRecord[][];
    rawJune2025: SalesRecord[];
    comparison: PerformanceComparison[];
    totals: {
      sales3Months2026: number;
      sales3Months2025: number;
      june2025: number;
      suggestedGoal2026: number;
      growthRate: number;
    };
  }> {
    this.logger.log(`Generating sales strategy metrics comparison for Month ${month}/${year}...`);

    // Calculate months in range (3 months prior to target month)
    const prevMonths: { year: number; month: number }[] = [];
    for (let i = 3; i >= 1; i--) {
      let m = month - i;
      let y = year;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      prevMonths.push({ year: y, month: m });
    }

    // 1. Fetch 3 months of 2026
    const sales3Months2026 = await Promise.all(
      prevMonths.map(p => this.salesDataService.getVentasResumenXModelo({ anio: p.year, mes: p.month })),
    );

    // 2. Fetch 3 months of 2025
    const sales3Months2025 = await Promise.all(
      prevMonths.map(p => this.salesDataService.getVentasResumenXModelo({ anio: p.year - 1, mes: p.month })),
    );

    // 3. Fetch June 2025 (target month of previous year)
    const june2025Sales = await this.salesDataService.getVentasResumenXModelo({ anio: year - 1, mes: month });

    // Helper: Map data arrays to model names dictionary
    const mapByModel = (monthsData: SalesRecord[][]) => {
      const modelMap = new Map<string, { brand: string; count: number }>();
      
      monthsData.forEach(monthRecords => {
        monthRecords.forEach(rec => {
          if (rec.tipo.toLowerCase() === 'seminuevo') return; // focus on brand models (new cars)
          const key = rec.modelo.toUpperCase().trim();
          const current = modelMap.get(key) || { brand: rec.marca, count: 0 };
          current.count += rec.unidadesVendidas;
          modelMap.set(key, current);
        });
      });

      return modelMap;
    };

    const modelMap2026 = mapByModel(sales3Months2026);
    const modelMap2025 = mapByModel(sales3Months2025);

    const june2025Map = new Map<string, number>();
    june2025Sales.forEach(rec => {
      if (rec.tipo.toLowerCase() === 'seminuevo') return;
      june2025Map.set(rec.modelo.toUpperCase().trim(), rec.unidadesVendidas);
    });

    // 4. Combine and calculate metrics
    const comparison: PerformanceComparison[] = [];
    
    // Collect all model keys
    const allModels = new Set([
      ...modelMap2026.keys(),
      ...modelMap2025.keys(),
      ...june2025Map.keys(),
    ]);

    let grandTotal2026 = 0;
    let grandTotal2025 = 0;
    let grandTotalJune2025 = 0;
    let grandTotalGoal = 0;

    allModels.forEach(modelKey => {
      const data2026 = modelMap2026.get(modelKey) || { brand: 'JETOUR', count: 0 };
      const data2025 = modelMap2025.get(modelKey) || { brand: 'JETOUR', count: 0 };
      const june25Count = june2025Map.get(modelKey) || 0;

      const sales2026 = data2026.count;
      const sales2025 = data2025.count;

      // Calculate growth rate: (2026 - 2025) / 2025 * 100
      let growthRate = 0;
      if (sales2025 > 0) {
        growthRate = parseFloat((((sales2026 - sales2025) / sales2025) * 100).toFixed(2));
      } else if (sales2026 > 0) {
        growthRate = 100; // New model entering market
      }

      // Target Goal calculation logic:
      // 1. Calculate current monthly average run rate (2026)
      const monthlyAvg2026 = sales2026 / 3;

      // 2. Determine target modifier based on YoY growth trend (capped between -40% and +40%)
      let targetModifier = 1.0;
      if (sales2025 > 0) {
        const rawGrowth = (sales2026 - sales2025) / sales2025;
        // Cap growth modifier between -40% and +40%
        targetModifier = 1 + Math.max(-0.4, Math.min(0.4, rawGrowth));
      } else if (sales2026 > 0) {
        // If there were no sales in 2025, assume positive trend but capped at +40%
        targetModifier = 1.4;
      }

      // 3. Project suggested goal: 70% weighted on adjusted monthly average, 30% on previous year's month sales (estacionalidad)
      const projectedGoal = 0.7 * (monthlyAvg2026 * targetModifier) + 0.3 * june25Count;
      
      // 4. Ensure suggested goal is realistic (capped at max 140% of recent monthly average, with a floor of recent average or at least 1)
      let suggestedGoal = Math.round(projectedGoal);
      const capLimit = Math.round(monthlyAvg2026 * 1.4);
      
      if (suggestedGoal > capLimit) {
        suggestedGoal = capLimit;
      }
      
      const floorLimit = Math.max(Math.round(monthlyAvg2026), 1);
      if (suggestedGoal < floorLimit) {
        suggestedGoal = floorLimit;
      }

      grandTotal2026 += sales2026;
      grandTotal2025 += sales2025;
      grandTotalJune2025 += june25Count;
      grandTotalGoal += suggestedGoal;

      comparison.push({
        model: modelKey,
        brand: data2026.brand || 'JETOUR',
        sales3Months2026: sales2026,
        sales3Months2025: sales2025,
        june2025: june25Count,
        growthRate,
        suggestedGoal2026: suggestedGoal,
      });
    });

    // Calculate overall growth
    let totalGrowthRate = 0;
    if (grandTotal2025 > 0) {
      totalGrowthRate = parseFloat((((grandTotal2026 - grandTotal2025) / grandTotal2025) * 100).toFixed(2));
    }

    return {
      raw2026: sales3Months2026,
      raw2025: sales3Months2025,
      rawJune2025: june2025Sales,
      comparison,
      totals: {
        sales3Months2026: grandTotal2026,
        sales3Months2025: grandTotal2025,
        june2025: grandTotalJune2025,
        suggestedGoal2026: grandTotalGoal,
        growthRate: totalGrowthRate,
      },
    };
  }
}
