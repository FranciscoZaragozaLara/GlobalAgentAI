# Manual de APIs de Ventas - Inventario de Vehículos

Este documento detalla las APIs para consultar la existencia de vehículos nuevos y seminuevos, sus valores de inventario, días promedio de antigüedad y agrupaciones.

## 1. Totales de Existencia (Nuevos, Seminuevos y Totales)

Entrega métricas de volumen, valor total y eficiencia de rotación (días máximo, mínimo y promedio en inventario) divididos por rangos de antigüedad de días (0-30, 31-60, 61-90, 91-120, 121+).

*   **URL**: `https://globaldms.mx/globalapiOracle/Kpis/getExistenciaVehiculos/NuevosSeminuevosTotales`
*   **Método**: `POST`
*   **Payload (JSON)**:
    ```json
    {
      "buscaDistribuidor": 0,
      "idDistribuidor": []
    }
    ```
*   **Respuesta de Ejemplo (results)**:
    ```json
    {
      "total_unidades": {
        "total": 1569,
        "nuevos": 1523,
        "seminuevos": 46,
        "proporcion_nuevos_seminuevos": {
          "ratio_nuevos_seminuevos": 33.11,
          "nuevos_pct": 97.07,
          "seminuevos_pct": 2.93
        }
      },
      "valor_total_inventario": {
        "total": 997340675,
        "nuevos": 981418733.5,
        "seminuevos": 15921941.5
      },
      "eficiencia": {
        "dias_promedio": {
          "total": 137.65,
          "nuevos": 137.27,
          "seminuevos": 150.38
        }
      }
    }
    ```

---

## 2. Resumen por Marca y Modelo

Entrega el inventario detallado agrupado por marca y modelo (para vehículos nuevos) y por marca (para seminuevos), con costo promedio, valor de inventario total y antigüedad promedio.

*   **URL**: `https://globaldms.mx/globalapiOracle/Kpis/getExistenciaVehiculos/ResumenMarcaModelo`
*   **Método**: `POST`
*   **Payload (JSON)**:
    ```json
    {
      "buscaDistribuidor": 0,
      "idDistribuidor": []
    }
    ```
*   **Respuesta de Ejemplo (results)**:
    ```json
    {
      "nuevos": [
        {
          "marca": "JETOUR",
          "modelo": "T2",
          "unidades_totales": 247,
          "costo_promedio": 638080.27,
          "valor_inventario_total": 157605827.84,
          "dias_promedio": 164.27
        }
      ],
      "seminuevos": [
        {
          "marca": "BMW",
          "unidades_totales": 1,
          "costo_promedio": 250000,
          "valor_inventario_total": 250000,
          "dias_promedio": 101.69
        }
      ]
    }
    ```
