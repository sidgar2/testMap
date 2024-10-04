import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import * as L from 'leaflet';
import proj4 from 'proj4';
import geojson2h3 from 'geojson2h3';
import * as h3 from 'h3-js';
import {GeoFeatureProperties} from "../models/geo.model";
import {Feature, FeatureCollection, GeoJSON, MultiPolygon} from "geojson";

@Injectable({
  providedIn: 'root'
})
export class MapService {
  constructor(private readonly http: HttpClient) {
  }

  getMapData(map: L.Map): void {
    this.http.get<FeatureCollection<MultiPolygon, GeoFeatureProperties>>('/assets/data.json')
      .subscribe((data: FeatureCollection<MultiPolygon, GeoFeatureProperties>) => {
        this.addHexagons(data, map);
      });
  }

  private addHexagons(data: FeatureCollection<MultiPolygon, GeoFeatureProperties>, map: L.Map): void {
    const features = data.features;

    features.forEach((feature: Feature<MultiPolygon, GeoFeatureProperties>) => {
      const coordinates = (feature.geometry as MultiPolygon).coordinates;
      const color = `#${feature.properties.COLOR_HEX}`;

      coordinates.forEach((cords: number[][][]) => {
        const convertedCoords = cords.map((cord: number[][]) => cord.map((coord: number[]) => proj4('EPSG:3857', 'EPSG:4326', coord)));

        const zoomLevel = map?.getZoom() || 0;
        const hexResolution = this.getHexResolution(zoomLevel);

        const geojson: GeoJSON =
          {
            ...feature,
            geometry: {type: feature.geometry.type, coordinates: [convertedCoords]}
          };

        const h3Indexes = geojson2h3.featureToH3Set(geojson, hexResolution, {ensureOutput: true});

        h3Indexes.forEach((h3Index: string) => {
          const hexBoundary = h3.cellToBoundary(h3Index, true);
          const latLngs = hexBoundary.map<h3.CoordPair>((latlng: h3.CoordPair) => [latlng[1], latlng[0]]);

          L.polygon(latLngs, {fillColor: color, color: "#000", weight: 1, fillOpacity: 0.7}).addTo(map);
        });
      });
    });
  }

  private getHexResolution(zoomLevel: number): number {
    if (zoomLevel < 5) return 5;
    return 4;
  }
}
