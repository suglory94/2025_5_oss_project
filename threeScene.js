// threeScene.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";


console.log("threeScene.js 로드됨");

let initialized = false;
let resizeObserver;

let scene, camera, renderer;
let character;
let money;

function createFace() {
  const face = new THREE.Group();

  // 재질
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  /* ===== 눈 ===== */
  function createEye(x) {
    const eye = new THREE.Group();

    // 흰자
    const eyeWhite = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.02),
      whiteMat
    );

    // 눈동자
    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.01),
      blackMat
    );
    pupil.position.z = 0.015;

    eye.add(eyeWhite);
    eye.add(pupil);
    eye.position.set(x, 0.05, 0.23);

    return eye;
  }

  const leftEye = createEye(-0.09);
  const rightEye = createEye(0.09);

  /* ===== 입 (웃는 입) ===== */
  const mouth = new THREE.Group();

  const mouthLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.025, 0.01),
    blackMat
  );
  mouthLeft.rotation.z = 0.3;
  mouthLeft.position.x = -0.04;

  const mouthRight = mouthLeft.clone();
  mouthRight.rotation.z = -0.3;
  mouthRight.position.x = 0.04;

  const mouthCenter = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.02, 0.01),
    blackMat
  );

  mouth.add(mouthLeft);
  mouth.add(mouthCenter);
  mouth.add(mouthRight);
  mouth.position.set(0, -0.08, 0.23);

  /* ===== 합치기 ===== */
  face.add(leftEye);
  face.add(rightEye);
  face.add(mouth);

  // 표정 제어용 저장
  face.userData = {
    leftEye,
    rightEye,
    mouth,
  };

  return face;
}

export function initThreeScene() {
    if (initialized) return;   // ⭐ 핵심
    initialized = true;
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, 320 / 420, 0.1, 100);
    camera.position.set(0, 0.5, 4.8);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    const container = document.getElementById("three-container");
    container.innerHTML = ""; // 재초기화 방지
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    container.appendChild(renderer.domElement);

    scene.background = new THREE.Color(0x111111);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(2, 5, 3);
    scene.add(light);

    // 캐릭터 그룹
    character = new THREE.Group();
    scene.add(character);

    // 몸통
    const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    body.position.y = 0.6;
    character.add(body);

    // 머리
    const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xffccaa })
    );
    head.position.y = 1.45;
    character.add(head);

    //얼굴
    const face = createFace();
    head.add(face);

    // 저장
    character.userData.face = face;

    // 팔 생성 함수
    function createArm() {
    const shoulder = new THREE.Group();

    const upper = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.45, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    upper.position.y = -0.2;
    shoulder.add(upper);

    const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.4, 0.16),
        new THREE.MeshStandardMaterial({ color: 0xbbbbbb })
    );
    lower.position.y = -0.45;
    upper.add(lower);

    return { shoulder, lower };
    }

    // 오른팔
    const rightArmData = createArm();
    rightArmData.shoulder.position.set(0.45, 1.05, 0);
    character.add(rightArmData.shoulder);

    // 왼팔
    const leftArmData = createArm();
    leftArmData.shoulder.position.set(-0.45, 1.05, 0);
    character.add(leftArmData.shoulder);


    // 다리 생성 함수
    function createLeg(x) {
    const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.8, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x999999 })
    );
    leg.position.set(x, 0, 0);
    return leg;
    }
    const leftLeg = createLeg(-0.2);
    const rightLeg = createLeg(0.2);

    leftLeg.position.y = -0.4;
    rightLeg.position.y = -0.4;

    character.add(leftLeg, rightLeg);


    // 돈 (오른팔에 붙이기)
    money = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.12, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x2ecc71 })
    );
    money.visible = false;
    money.position.set(0, -0.3, 0.15);
    rightArmData.lower.add(money);

    // 외부에서 쓰기 위해 저장
    character.userData = {
    head,
    rightArmData
    };

    scene.background = new THREE.Color(0x111111);

    character.scale.set(0.9, 0.9, 0.9);
    character.position.set(0, -0.4, 0);

    updateFinanceStatus(70);

    animate();
    
    resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w && h) {
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
    });
    resizeObserver.observe(container);
}

export function updateFinanceStatus(financePercent) {
    const { head, rightArmData, face } = character.userData;
    const { shoulder, lower } = rightArmData;

     /* ===== 팔 + 돈 ===== */
  if (financePercent >= 50) {
    money.visible = true;
    shoulder.rotation.x = -0.6;
    lower.rotation.x = -0.8;
    money.rotation.z = 0.2;
    character.rotation.y = 0;
  } else {
    money.visible = false;
    shoulder.rotation.x = -0.2;
    lower.rotation.x = -0.2;
    character.rotation.y = -0.2;
  }

  /* ===== 얼굴 표정 (★ 안전 가드 필수) ===== */
  if (!face || !face.userData) return;  // ⭐ 이 줄이 핵심

  const { mouth, leftEye, rightEye } = face.userData;
  if (!mouth || !leftEye || !rightEye) return; // ⭐ 한 번 더 안전

  if (money.visible) {
    // 😄 웃는 얼굴
    mouth.scale.set(1, 1, 1);
    mouth.rotation.z = 0;
    leftEye.scale.y = 1;
    rightEye.scale.y = 1;
  } else {
    // 😟 찡그린 얼굴
    mouth.scale.set(1, 0.5, 1);
    mouth.rotation.z = Math.PI;
    leftEye.scale.y = 0.8;
    rightEye.scale.y = 0.8;
  }
    

}

function animate() {
  requestAnimationFrame(animate);
  character.rotation.y += 0.003;
  renderer.render(scene, camera);
}

window.initThreeScene = initThreeScene;

export function resizeThreeScene() {
  if (!renderer || !camera) return;

  renderer.setSize(320, 420);
  camera.aspect = 320 / 420;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

/*main.js에서 쓸거
export function updateCharacterStatus({
  financeScore,
  studyScore,
  sleepScore
}) {
  updateFinance(financeScore);
  updateStudy(studyScore);
  updateSleep(sleepScore);
};*/