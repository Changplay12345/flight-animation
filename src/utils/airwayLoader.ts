import Papa from 'papaparse';

export interface AirwayPoint {
  fid: number;
  route_identifier: string;
  area_code: string;
  seqno: number;
}

export interface AirwayData {
  [routeId: string]: AirwayPoint[];
}

export async function loadAirways(): Promise<AirwayData> {
  return new Promise((resolve, reject) => {
    Papa.parse('/airways/airway.csv', {
      download: true,
      header: true,
      complete: (results) => {
        try {
          const airways: AirwayData = {};
          const points = results.data as AirwayPoint[];
          
          // Filter for Thailand region (SPA, MES, CAN area codes)
          const thailandAreaCodes = ['SPA', 'MES', 'CAN'];
          const filteredPoints = points.filter(point => 
            thailandAreaCodes.includes(point.area_code.trim())
          );
          
          // Group by route identifier
          filteredPoints.forEach(point => {
            const routeId = point.route_identifier.trim();
            if (!airways[routeId]) {
              airways[routeId] = [];
            }
            airways[routeId].push(point);
          });
          
          // Sort each route by sequence number
          Object.keys(airways).forEach(routeId => {
            airways[routeId].sort((a, b) => a.seqno - b.seqno);
          });
          
          console.log(`Loaded ${Object.keys(airways).length} airway routes for Thailand region`);
          resolve(airways);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
