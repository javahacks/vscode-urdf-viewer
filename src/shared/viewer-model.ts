export interface Color {
  rgba: string;
}

export interface Texture {
  filename: string;
}

export interface Material {
  name: string;
  color: Color;
  texture: Texture;
}

export interface MaterialReference {
  name: string;
}

export interface Box {
  size: string;
}

export interface Cylinder {
  radius: string;
  length: string;
}

export interface Mesh {
  filename: string;
  scale: string;
}

export interface Sphere {
  radius: string;
}

export interface Geometry {
  box: Box;
  cylinder: Cylinder;
  mesh: Mesh;
  sphere: Sphere;
}

export interface Origin {
  xyz: string;
  rpy: string;
}

export interface Visual {
  geometry: Geometry;
  material: MaterialReference;
  origin: Origin;
}

export interface Link {
  name: string;
  visual: Visual;
}

export interface Parent {
  link: string;
}

export interface Child {
  link: string;
}

export interface Axis {
  xyz: string;
}

export interface Limit {
  lower: string;
  upper: string;
}

export interface Joint {
  name: string;
  type: string;
  origin: Origin;
  parent: Parent;
  child: Child;
  axis: Axis;
  limit: Limit;
}

export interface Robot {
  name: string;
  version: string;
  material: Material[];
  link: Link[];
  joint: Joint[];
}

export class ViewerModel {
  robot?: Robot;
  reset?: boolean;
  highlightMeshId?: string[];
}

export function patchUrlsAndArrays(
  robot: Robot,
  mapper: (oldFileName: string) => string
) {
  robot.joint = mapObjectToArray(robot.joint);
  robot.link = mapObjectToArray(robot.link);
  robot.material = mapObjectToArray(robot.material);

  for (const link of robot.link) {
    if (link?.visual?.geometry?.mesh?.filename) {
      link.visual.geometry.mesh.filename = mapper(
        link.visual.geometry.mesh.filename
      );
    }
  }

  for (const material of robot.material) {
    if (material?.texture?.filename) {
      material.texture.filename = mapper(material?.texture?.filename);
    }
  }
}
function mapObjectToArray(object: any) {
  if (Array.isArray(object)) {
    return object;
  }
  if (object) {
    return [object];
  }
  return [];
}

export function stringToColor(value: String) {
  const numbers = value.trim().split(/\s+/);
  return {
    red: Number.parseFloat(numbers[0]),
    green: Number.parseFloat(numbers[1]),
    blue: Number.parseFloat(numbers[2]),
    alpha: Number.parseFloat(numbers[3])
  };
}

export function stringToVector3(value: String) {
  const numbers = value.trim().split(/\s+/);
  return {
    x: Number.parseFloat(numbers[0]),
    y: Number.parseFloat(numbers[2]), // swap y and z coordinates
    z: Number.parseFloat(numbers[1])
  };
}

export function stringToOrientation(value: String) {
  const numbers = value.trim().split(/\s+/);
  return {
    roll: Number.parseFloat(numbers[0]),
    yaw: Number.parseFloat(numbers[1]), // swap y and z coordinates
    pitch: Number.parseFloat(numbers[2])
  };
}
