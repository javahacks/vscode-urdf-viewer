import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders';
import {
  AdvancedDynamicTexture,
  Control,
  Slider,
  StackPanel,
  TextBlock
} from '@babylonjs/gui/2D';
import {
  AbstractMesh,
  ArcRotateCamera,
  AssetTaskState,
  TransformNode
} from '@babylonjs/core/Legacy/legacy';
import {
  Robot,
  Link,
  stringToOrientation,
  stringToVector3,
  stringToColor,
  Joint,
  Material
} from '../shared/viewer-model';

/**
 * This component is used to render 'RobotDescription' models.
 */
export class URDFRenderer {
  private idMeshMap = new Map<string, AbstractMesh>();
  private idMaterialMap = new Map();
  private scene!: BABYLON.Scene;
  private menuPanel!: StackPanel;
  private updateCycle: number = 0;

  public attachCanvas(canvas: HTMLCanvasElement) {
    const engine = new BABYLON.Engine(canvas, true);
    this.createScene(engine, canvas);
  }

  private createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement) {
    this.scene = new BABYLON.Scene(engine);
    this.scene.clearColor = BABYLON.Color4.FromInts(0, 0, 0, 0);

    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      0,
      Math.PI / 4,
      3,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    camera.wheelPrecision = 100;
    camera.lowerRadiusLimit = 2;
    camera.upperRadiusLimit = 10;

    camera.attachControl(canvas, true);
    new BABYLON.HemisphericLight(
      'hs-light',
      new BABYLON.Vector3(1, 1, 0),
      this.scene
    );

    const menuTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      'menu',
      true,
      this.scene
    );
    this.menuPanel = new StackPanel();
    this.menuPanel.width = '120px';
    this.menuPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.menuPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.menuPanel.paddingRight = 5;
    menuTexture.addControl(this.menuPanel);

    engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  public resize(): void {
    this.scene?.getEngine().resize();
  }

  public resetModel() {
    this.idMeshMap.forEach((value) => value.dispose());
    this.idMaterialMap.forEach((value) => value.dispose());
    this.menuPanel.clearControls();
    this.idMeshMap.clear();
    this.idMaterialMap.clear();
  }

  highlightMesh(meshId: string) {
    const reset = !this.idMeshMap.has(meshId);
    this.idMeshMap.forEach((mesh: AbstractMesh, id: string) => {
      if (mesh.material) {
        mesh.material.alpha = reset || meshId === id ? 1.0 : 0.4;
      }
    });
  }

  public resetView() {
    const camera = this.scene.getCameraByID('camera') as ArcRotateCamera;
    camera.alpha = 0;
    camera.beta = Math.PI / 4;
    camera.setTarget(BABYLON.Vector3.Zero());
  }

  public initRobotModel(robot: Robot) {
    this.initMaterials(robot);
    this.initLinks(robot);
    this.loadMeshes(robot);
    this.idMaterialMap.forEach((material) => material.dispose());
  }

  private initLinks(robot: Robot) {
    for (const link of robot.link.filter((link) => link.visual?.geometry)) {
      if (link.visual.geometry.box) {
        this.initBox(link);
      }
      if (link.visual.geometry.cylinder) {
        this.initCylinder(link);
      }
      if (link.visual.geometry.sphere) {
        this.initSphere(link);
      }
    }
  }

  private initSphere(link: Link) {
    const sphere = link.visual.geometry.sphere;
    const mesh = BABYLON.MeshBuilder.CreateSphere(
      link.name,
      {
        diameter: Number.parseFloat(sphere.radius) * 2,
        segments: 32
      },
      this.scene
    );

    this.idMeshMap.set(link.name, mesh);
    this.setupBaseProperties(mesh, link);
  }

  private initCylinder(link: Link) {
    const cylinder = link.visual.geometry.cylinder;

    const mesh = BABYLON.MeshBuilder.CreateCylinder(
      link.name,
      {
        height: Number.parseFloat(cylinder.length),
        diameter: Number.parseFloat(cylinder.radius) * 2
      },
      this.scene
    );
    this.idMeshMap.set(link.name, mesh);
    this.setupBaseProperties(mesh, link);
  }

  private initBox(link: Link) {
    if (!link.visual.geometry.box.size) {
      return;
    }
    const dimension = stringToVector3(link.visual.geometry.box.size);
    const mesh = BABYLON.MeshBuilder.CreateBox(
      link.name,
      {
        width: dimension.x,
        height: dimension.y,
        depth: dimension.z
      },
      this.scene
    );
    this.idMeshMap.set(link.name, mesh);
    this.setupBaseProperties(mesh, link);
  }

  private loadMeshes(robot: Robot) {
    const assetsManager = new BABYLON.AssetsManager(this.scene);
    assetsManager.useDefaultLoadingScreen = false;
    const loadedMeshes: AbstractMesh[] = [];

    for (const link of robot.link) {
      if (link.visual?.geometry?.mesh?.filename) {
        this.addMeshTask(link, assetsManager, loadedMeshes);
      }
    }

    this.updateCycle++;
    const currentCycle = this.updateCycle;

    assetsManager.onFinish = (tasks) => {
      if (currentCycle === this.updateCycle) {
        this.connectMeshes(robot);
      } else {
        loadedMeshes.forEach((m) => m.dispose());
      }
    };

    assetsManager.load();
  }

  private addMeshTask(
    link: Link,
    assetsManager: BABYLON.AssetsManager,
    loadedMeshes: BABYLON.AbstractMesh[]
  ) {
    const meshVisual = link.visual.geometry.mesh;
    const fullMeshURI = link.visual.geometry.mesh.filename;
    const baseURl = fullMeshURI.substr(0, fullMeshURI.lastIndexOf('/') + 1);
    const fileName = fullMeshURI.substr(fullMeshURI.lastIndexOf('/') + 1);

    const meshTask = assetsManager.addMeshTask(
      'Task-' + this.updateCycle,
      link.name,
      baseURl,
      fileName
    );

    meshTask.onSuccess = (task) => {
      if (task.loadedMeshes.length === 1) {
        const loadedMesh = task.loadedMeshes[0];
        loadedMeshes.push(loadedMesh);
        this.idMeshMap.set(link.name, loadedMesh);
        this.setupBaseProperties(loadedMesh, link);
        if (meshVisual.scale) {
          const vec3 = stringToVector3(meshVisual.scale);
          loadedMesh.scaling = new BABYLON.Vector3(
            this.getScaleFactor(vec3.x),
            this.getScaleFactor(vec3.y),
            this.getScaleFactor(vec3.z)
          );
        }
      }
    };
  }

  private getScaleFactor(scale: number) {
    return scale > 0 ? scale : 1.0;
  }

  private setupBaseProperties(mesh: AbstractMesh, link: Link) {
    if (link.visual.origin?.xyz) {
      const size = stringToVector3(link.visual.origin.xyz);
      mesh.position = new BABYLON.Vector3(size.x, size.y, size.z);
    }
    if (link.visual.origin?.rpy) {
      const orientation = stringToOrientation(link.visual.origin.rpy);
      mesh.rotation = new BABYLON.Vector3(
        orientation.roll,
        orientation.pitch,
        orientation.yaw
      );
    }
    if (link.visual.material?.name) {
      mesh.material = this.idMaterialMap.get(link.visual.material.name).clone();
    }
  }

  private initMaterials(robot: Robot) {
    for (const material of robot.material) {
      const standardMaterial = new BABYLON.StandardMaterial(
        material.name,
        this.scene
      );
      standardMaterial.zOffset = robot.material.indexOf(material);
      this.idMaterialMap.set(standardMaterial.name, standardMaterial);

      if (material.color) {
        const rgba = stringToColor(material.color.rgba);
        material.color.rgba;
        standardMaterial.diffuseColor = new BABYLON.Color3(
          rgba.red,
          rgba.green,
          rgba.blue
        );
        standardMaterial.alpha = rgba.alpha;
      }
      if (material.texture) {
        standardMaterial.diffuseTexture = new BABYLON.Texture(
          material.texture.filename,
          this.scene
        );
      }
    }
  }

  private connectMeshes(robot: Robot) {
    for (const joint of robot.joint) {
      const transform = new BABYLON.TransformNode(joint.name);
      if (joint.origin?.xyz) {
        const vec = stringToVector3(joint.origin.xyz);
        transform.position = new BABYLON.Vector3(vec.x, vec.y, vec.z);
      }
      if (joint.origin?.rpy) {
        const orientation = stringToOrientation(joint.origin.rpy);
        transform.rotation = new BABYLON.Vector3(
          orientation.roll,
          orientation.pitch,
          orientation.yaw
        );
      }

      if (joint.type === 'continuous') {
        //not really continous but full clock- and counterclockwise rotation
        joint.limit = {
          lower: (-Math.PI * 2).toString(),
          upper: (Math.PI * 2).toString()
        };
        this.addJointControl(joint, transform);
      }

      if (joint.type === 'revolute') {
        this.addJointControl(joint, transform);
      }

      const parent = this.idMeshMap.get(joint.parent.link);
      const child = this.idMeshMap.get(joint.child.link);
      if (child && parent) {
        transform.parent = parent.parent ? parent.parent : parent;
        child.parent = transform;
      }
    }
  }
  private addJointControl(joint: Joint, transform: TransformNode) {
    const lowerLimit = Number.parseFloat(joint.limit?.lower);
    const upperLimit = Number.parseFloat(joint.limit?.upper);

    if (lowerLimit === 0 && upperLimit === 0) {
      return;
    }

    const header = new TextBlock();
    this.setHeaderText(header, joint.name, 0);
    header.height = '20px';
    header.paddingTop = 2;
    header.fontSize = 10;
    header.color = 'grey';

    const slider = new Slider();
    slider.minimum = lowerLimit;
    slider.maximum = upperLimit;
    slider.value = (lowerLimit + upperLimit) / 2;
    slider.height = '12px';
    slider.color = 'green';

    if (joint.origin && joint.axis) {
      slider.onValueChangedObservable.add((value) => {
        const rotation = stringToOrientation(joint.origin.xyz);
        const vec3 = stringToVector3(joint.axis.xyz);
        transform.rotation = new BABYLON.Vector3(
          rotation.roll,
          rotation.pitch,
          rotation.yaw
        );
        transform.rotate(
          new BABYLON.Vector3(vec3.x, vec3.y, vec3.z),
          value,
          BABYLON.Space.LOCAL
        );
        this.setHeaderText(header, joint.name, value);
      });
    }

    this.menuPanel.addControl(header);
    this.menuPanel.addControl(slider);
  }

  private setHeaderText(header: TextBlock, name: String, value: number) {
    header.text = name + ': ' + value.toFixed(2);
  }
}
