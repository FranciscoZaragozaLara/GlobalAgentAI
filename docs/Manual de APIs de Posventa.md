# **📘 Manual de Integración API: Módulo de Posventa y Servicio**

**Sistema:** Global DMS (ERP Jetour/Soueast)

**Dominio Base:** https://globaldms.mx/globalapiOracle/Kpis/

Este documento describe la estructura de peticiones (Requests) y respuestas (Responses) de los 4 endpoints principales utilizados para la extracción de métricas operativas de los talleres y órdenes de servicio.

## **🛠️ Estructura Base del Request (Payload Padrón)**

Dado que todas las APIs comparten la misma raíz, el payload enviado mediante el método **POST** mantiene una estructura estandarizada para filtrar por fecha y distribuidor.

**Método:** POST

**Headers:** Content-Type: application/json

{  
  "anio": 2026,  
  "buscaDistribuidor": 0,  
  "busquedaModelo": 0,  
  "busquedaPeriodo": 3,  
  "fechaFinal": "",  
  "fechaInicial": "",  
  "idDistribuidores": \[\],  
  "idRegion": \[\],  
  "mes": 6,  
  "modelo": "",  
  "page": 0,  
  "pageSize": 0  
}

* **busquedaPeriodo:** Define el tipo de filtrado de tiempo aplicable a todas las APIs de GlobalDMS:
  * `1` = Fechas específicas (utiliza `fechaInicial` y `fechaFinal`).
  * `2` = Año (agrupa por el año indicado en `anio`, con `mes` en `0`).
  * `3` = Mes (filtra por el mes y año indicados en `mes` y `anio`).

*Nota: Al enviar buscaDistribuidor: 0 y idDistribuidores: [], el ERP asume una consulta a nivel nacional (todos los distribuidores).*

## **1\. Resumen General del Taller**

Devuelve la salud general del negocio, incluyendo márgenes de rentabilidad, ticket promedio y retención de clientes.

* **URL:** /getOrdenesServicio/ResumenGeneral  
* **Método:** POST

### **Ejemplo de Response:**

{  
    "response": "OK",  
    "message": "",  
    "results": \[  
        {  
            "cantidadOrdenesReparacionFacturadas": "1499",  
            "ingresosOnedesReparacionFacturadasSinIVA": "5886248.77",  
            "ingresosOnedesReparacionFacturadasConIVA": "6835635.09",  
            "ticketPromedioOrdenesReparacionFacturadas": "3926.78",  
            "cantidadOrdenesReparacionEnProceso": "644",  
            "ingresosOrdenesReparacionEnProcesoSinIVA": "935790.39",  
            "ingresosOrdenesReparacionEnProcesoConIVA": "1089312.22",  
            "cantidadOrdenesTrabajoFacturadasConImporteCero": "19",  
            "permanenciaTallerTpu": "0.96",  
            "margenPorServicio": "21.43",  
            "productividad": "39.95",  
            "retencionClientesRecurrentes": "12.86"  
        }  
    \],  
    "page": "1",  
    "total\_results": "1",  
    "total\_pages": "1"  
}

## **2\. Evolución Mensual (Tendencia YoY)**

Muestra el histórico de órdenes agrupadas por año y por mes, ideal para calcular crecimientos interanuales.

* **URL:** /getOrdenesServicio/EvolucionMensual  
* **Método:** POST

### **Ejemplo de Response (Truncado para legibilidad):**

{  
    "response": "OK",  
    "message": "",  
    "results": {  
        "2025": \[  
            {  
                "mes": "Mayo",  
                "cantidadOrdenesReparacion": "684",  
                "ingresosOrdenesReparacionConIVA": "2314824.31"  
            },  
            {  
                "mes": "Junio",  
                "cantidadOrdenesReparacion": "849",  
                "ingresosOrdenesReparacionConIVA": "2347358.03"  
            }  
        \],  
        "2026": \[  
            {  
                "mes": "Mayo",  
                "cantidadOrdenesReparacion": "1608",  
                "ingresosOrdenesReparacionConIVA": "6955869.81"  
            },  
            {  
                "mes": "Junio",  
                "cantidadOrdenesReparacion": "1518",  
                "ingresosOrdenesReparacionConIVA": "6835635.09"  
            }  
        \]  
    },  
    "page": "1",  
    "total\_results": "1",  
    "total\_pages": "1"  
}

## **3\. Desglose por Canal de Ventas**

Divide los ingresos y la rentabilidad dependiendo del origen del servicio (Pública, Garantía, Internas, HYP).

* **URL:** /getOrdenesServicio/PorCanalVentas  
* **Método:** POST

### **Ejemplo de Response:**

{  
    "response": "OK",  
    "message": "",  
    "results": \[  
        {  
            "canalVentas": "GARANTIA",  
            "cantidadOrdenesTrabajoFacturadas": 198,  
            "ingresosOrdenesTrabajoFacturadasSinIVA": 784126.91,  
            "ingresosOrdenesTrabajoFacturadasConIVA": 909587.1,  
            "cantidadOrdenesTrabajoFacturadasConImporteCero": 0,  
            "ticketPromedioOrdenesTrabajoFacturadas": 47230.41,  
            "utilidadOrdenesTrabajoFacturadas": 175349.73,  
            "margenOrdenesTrabajoFacturadas": 22.36  
        },  
        {  
            "canalVentas": "PUBLICA",  
            "cantidadOrdenesTrabajoFacturadas": 767,  
            "ingresosOrdenesTrabajoFacturadasSinIVA": 3088584.16,  
            "ingresosOrdenesTrabajoFacturadasConIVA": 3602631.96,  
            "cantidadOrdenesTrabajoFacturadasConImporteCero": 15,  
            "ticketPromedioOrdenesTrabajoFacturadas": 3021909.02,  
            "utilidadOrdenesTrabajoFacturadas": 1330190.55,  
            "margenOrdenesTrabajoFacturadas": 43.07  
        }  
    \],  
    "page": "1",  
    "total\_results": "4",  
    "total\_pages": "1"  
}

## **4\. Mapa de Calor Operativo (TPU por Distribuidor en Proceso)**

Muestra el detalle atómico de cada agencia, indicando cuántos vehículos tienen estancados en el taller divididos por rangos de tiempo (Rango 4 \= \>90 días).

* **URL:** /getOrdenesServicio/TPUPorDistribuidorEnProceso  
* **Método:** POST

### **Ejemplo de Response (Truncado para legibilidad):**

{  
    "response": "OK",  
    "message": "",  
    "results": \[  
        {  
            "dealerId": "7002706",  
            "dealer": "JETOUR SOUEAST CORREGIDORA",  
            "razonSocial": "CONFIANZA ADC",  
            "cantidadOrdenesTrabajoEnProcesoTotal": "387",  
            "cantidadOrdenesTrabajoEnProcesoRango1": "11",  
            "cantidadOrdenesTrabajoEnProcesoRango2": "12",  
            "cantidadOrdenesTrabajoEnProcesoRango3": "22",  
            "cantidadOrdenesTrabajoEnProcesoRango4": "342"  
        },  
        {  
            "dealerId": "7002719",  
            "dealer": "JETOUR SOUEAST ANGELOPOLIS",  
            "razonSocial": "GRUPO HUERTA ONE",  
            "cantidadOrdenesTrabajoEnProcesoTotal": "392",  
            "cantidadOrdenesTrabajoEnProcesoRango1": "24",  
            "cantidadOrdenesTrabajoEnProcesoRango2": "34",  
            "cantidadOrdenesTrabajoEnProcesoRango3": "121",  
            "cantidadOrdenesTrabajoEnProcesoRango4": "213"  
        }  
    \],  
    "page": "1",  
    "total\_results": "49",  
    "total\_pages": "1"  
}  
