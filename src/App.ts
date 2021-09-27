import * as THREE from 'three';
import * as CANNON from 'cannon';
import { PlaneBufferGeometry, XRFrame, XRReferenceSpace, XRSession, XRViewerPose } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import type { XRSystem } from 'webxr';

class App {
    camera : THREE.PerspectiveCamera; 
    scene : THREE.Scene; 
    renderer : THREE.WebGLRenderer;
    geometry : THREE.BoxGeometry;
    material : THREE.Material;
    mesh : THREE.Mesh;
    user: THREE.Group;

    xrReferenceSpace : XRReferenceSpace;
    xrSession : XRSession;
    xrButton : HTMLElement;

    mixer: THREE.AnimationMixer;

    physicsWorld : CANNON.World;
    playerBox : CANNON.Body;
    groundBody : CANNON.Body;

    playerHeight : THREE.Vector3;

    clock :  THREE.Clock;

    animations = new Array();

    init() {
        let _this = this;

        this.clock = new THREE.Clock();

        this.playerHeight = new THREE.Vector3();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#C0986D");

        //lights
        const hemiLight = new THREE.HemisphereLight();
        hemiLight.name = 'hemi_light';
        //this.scene.add(hemiLight);

        const light1  = new THREE.AmbientLight();
        light1.name = 'ambient_light';
        //this.scene.add( light1 );

        const light2  = new THREE.DirectionalLight();
        light2.position.set(0.5, 0, 0.866); // ~60º
        light2.name = 'main_light';
        //this.scene.add( light2 );

        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.01, 100);
        this.user = new THREE.Group();
        this.user.add(this.camera);
        this.scene.add(this.user);
    
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", precision: "highp" });
        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType('local-floor');
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.extensions.get("OCULUS_multiview");
        this.renderer.extensions.get("OVR_multiview2");

        //ground visual
        const geometry = new THREE.BoxGeometry( 1, 0.1, 1 );
        const material = new THREE.MeshBasicMaterial( {color: 0xffffff} );
        const cube = new THREE.Mesh( geometry, material );
        cube.position.y = -1;
        this.scene.add( cube );
        

        //physics
        const defaultMaterial = new CANNON.Material("default");
        const playerMaterial = new CANNON.Material("player");
        const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, playerMaterial, {
            friction: 0.01,
            restitution: 0.0,
        });

        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -9.82, 0);
        this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
        this.physicsWorld.addContactMaterial(defaultContactMaterial);
        this.physicsWorld.defaultContactMaterial = defaultContactMaterial;

        //ground
        let groundShape = new CANNON.Box(new CANNON.Vec3(1,0.1,1));
        this.groundBody = new CANNON.Body({ mass: 0,material: defaultMaterial });
        this.groundBody.type = CANNON.Body.STATIC;
        this.groundBody.addShape(groundShape, new CANNON.Vec3(0, 0, 0));

        this.physicsWorld.addBody(this.groundBody);

        //add player hitbox
        let shape1 = new CANNON.Sphere(0.075);
        this.playerBox = new CANNON.Body({ mass: 65, material: playerMaterial });
        this.playerBox.angularDamping = 1;
        this.playerBox.type = CANNON.Body.DYNAMIC;
        //this.playerBox.position.y = 1;
        this.playerBox.addShape(shape1, new CANNON.Vec3(0, 0.10, 0));

        this.physicsWorld.addBody(this.playerBox);

        //background
        //this.mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2,1,1),new THREE.MeshBasicMaterial());
        //this.mesh.rotation.setFromVector3(new THREE.Vector3(-1.5708,0,0))
        //this.mesh.position.set(0,0,0);
        //this.scene.add(this.mesh)

        var background = new THREE.Mesh(
            new THREE.SphereBufferGeometry(20),
            new THREE.ShaderMaterial({
              uniforms: {
                uColorA: { value: new THREE.Color("rgb(0, 102, 55)") },
                uColorB: { value: new THREE.Color("rgb(0, 15, 40)") }
              },
              vertexShader: require('./gradient.vert.glsl'),
              fragmentShader: require('./gradient.frag.glsl')
            })
          )
        background.material.depthWrite = false
        background.renderOrder = -99999
        this.scene.add(background);
        console.log(background)

        //enter vr button
        this.xrButton = document.createElement("button");
        this.xrButton.innerHTML = "Enter VR";
        this.xrButton.addEventListener("click", function() {
            const xr = (navigator as any)?.xr as XRSystem;
            const sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor'] };
            xr.requestSession('immersive-vr', sessionInit).then((_session) => {
                _this.renderer.xr.setSession((_session as any) as XRSession);
                _this.renderer.xr.addEventListener('sessionstart',() => _this.sessionStarted());
            });
        });

        let textureLoader = new THREE.TextureLoader();
        textureLoader.load('env.jpg',(texture) => {

            texture.mapping = THREE.EquirectangularReflectionMapping;
            const loader = new GLTFLoader();
            loader.load(
                'boss-battle.gltf',
                ( gltf ) => {
                    console.log(gltf)
                    this.mixer = new THREE.AnimationMixer(gltf.scene);
    
                    let clips = gltf.animations;
    
                    let clip = THREE.AnimationClip.findByName( clips, 'notice' );
                    const action = this.mixer.clipAction( clip );
                    action.setLoop(THREE.LoopOnce,1);
                    action.clampWhenFinished = true;
                    //action.play()
                    this.animations.push(action);
    
                    let clip1 = THREE.AnimationClip.findByName( clips, 'left-display' );
                    const action1 = this.mixer.clipAction( clip1 );
                    action1.setLoop(THREE.LoopRepeat,999);
                    //action1.play();
                    this.animations.push(action1);
                    
                    let clip2 = THREE.AnimationClip.findByName( clips, 'right-display' );
                    const action2 = this.mixer.clipAction( clip2 );
                    action2.setLoop(THREE.LoopRepeat,999);
                    //action2.play();
                    this.animations.push(action2);
                    
                    console.log(this.renderer)

                    //var cubeRenderTarget = new THREE.WebGLCubeRenderTarget(1024).fromEquirectangularTexture(this.renderer, texture);
                    gltf.scene.traverse((node : THREE.Object3D) => {
                      if (node.type = 'Mesh'){
                        if(((node as THREE.Mesh)?.material as THREE.MeshBasicMaterial)?.envMap !== undefined){
                            ((node as THREE.Mesh).material as THREE.MeshBasicMaterial).envMap = texture;
                            ((node as THREE.Mesh).geometry.computeVertexNormals());
                            console.log(((node as THREE.Mesh).material as THREE.MeshBasicMaterial));
                        }
                      } 
                    });
    
                    // called when the resource is loaded
                    this.scene.add( gltf.scene );
                },
                ( xhr ) => {
                    // called while loading is progressing
                    this.xrButton.innerHTML =  `${( xhr.loaded / xhr.total * 100 )}% loaded`;
                    console.log( `${( xhr.loaded / xhr.total * 100 )}% loaded` );
                },
                ( error ) => {
                    // called when loading has errors
                    console.error( 'An error happened', error );
                },
            );    
        });

        document.body.appendChild( this.renderer.domElement );
        document.body.appendChild( this.xrButton );
    }

    sessionStarted(){
        this.xrReferenceSpace = this.renderer.xr.getReferenceSpace();
        this.xrReferenceSpace.onreset = (event : Event) => this.positionReset(event);

        this.clock.getDelta()
        this.renderer.xr.setAnimationLoop((time,frame) => this.draw(time,frame))

        for (const key in this.animations) {
            this.animations[key].play();
        }

        setTimeout(() => {
            var audio = new Audio('gametest1.mp3');
            audio.loop = true;
            audio.play();
        },6000)
    }

    positionReset(event : Event){
        this.playerBox.velocity.set(0,0,0);
        this.playerBox.position.set(0,0,0);
    }

    delta : number = 0;
    pose : XRViewerPose;
    deltaPosition: THREE.Vector3  = new THREE.Vector3();
    rotatedDelta : THREE.Vector3 = new THREE.Vector3();
    draw (time : number, xrFrame : XRFrame){
        this.delta = this.clock.getDelta();

        //this.pose = xrFrame.getViewerPose(this.xrReferenceSpace);
    
        //this.mixer.update( this.delta );

        //this.updateAndMatchPhysics(this.delta,this.pose)
        this.renderer.render( this.scene, this.camera );

    }

    updateAndMatchPhysics(delta : number, pose : XRViewerPose) {

    
        this.physicsWorld.step(1 / 60, delta);

        this.playerHeight.setY(pose.transform.position.y);

        //calculate movement delta
        this.deltaPosition.sub(pose.transform.position as any);
        this.rotatedDelta.copy(this.deltaPosition);
        this.rotatedDelta.setY(0);
        this.rotatedDelta.applyQuaternion(this.user.quaternion);
    
        this.playerBox.position.vsub(this.rotatedDelta as any as CANNON.Vec3, this.playerBox.position);
        //reset delta
        this.deltaPosition.copy(pose.transform.position as any as THREE.Vector3);
    
        //match current Playerposition to physical Position
        this.moveVirtualPlayerToMatch(pose, this.playerBox.position as any as THREE.Vector3);
    }

    rotatedLocalPosition : THREE.Vector3 = new THREE.Vector3();
    virtualMatchPosition : THREE.Vector3 = new THREE.Vector3();
    moveVirtualPlayerToMatch(space : XRViewerPose, position : THREE.Vector3) {
        this.rotatedLocalPosition.copy(space.transform.position as any).applyQuaternion(this.user.quaternion);
        this.virtualMatchPosition.copy(position).add(this.rotatedLocalPosition.negate());
    
        this.user.position.copy(this.virtualMatchPosition.add(this.playerHeight));
    }    
}

export default App