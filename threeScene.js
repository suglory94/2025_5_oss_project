// threeScene.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";


console.log("threeScene.js 로드됨");

let initialized = false;
let resizeObserver;

let scene, camera, renderer;
let characterRoot; // 회전용
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

function createDarkCircles() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.6
    });

    function circle(x) {
        const m = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.04, 0.01),
            mat
        );
        m.position.set(x, -0.01, 0.23);
        return m;
    }

    group.add(circle(-0.09));
    group.add(circle(0.09));
    group.visible = false;
    return group;
}

function createZzz() {
    const zzz = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        emissive: 0x888888,
        emissiveIntensity: 0.5
    });

    function createZ(scale = 1) {
        const z = new THREE.Group();

        const top = new THREE.Mesh(
            new THREE.BoxGeometry(0.18 * scale, 0.02 * scale, 0.02),
            mat
        );
        top.position.y = 0.06 * scale;

        const mid = new THREE.Mesh(
            new THREE.BoxGeometry(0.18 * scale, 0.02 * scale, 0.02),
            mat
        );
        mid.rotation.z = Math.PI / 4;

        const bottom = top.clone();
        bottom.position.y = -0.06 * scale;

        z.add(top, mid, bottom);
        return z;
    }

    const z1 = createZ(1);
    const z2 = createZ(0.8);
    const z3 = createZ(0.6);

    z1.position.set(0.15, 0.2, 0);
    z2.position.set(0.05, 0.35, 0);
    z3.position.set(-0.05, 0.48, 0);

    zzz.add(z1, z2, z3);
    zzz.visible = false;

    return zzz;
}

function createPlus(color = 0x22c55e) {
    const plus = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6
    });

    const bar1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.03, 0.02),
        mat
    );

    const bar2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.12, 0.02),
        mat
    );

    plus.add(bar1);
    plus.add(bar2);

    return plus;
}

function createPlusAura() {
    const aura = new THREE.Group();

    for (let i = 0; i < 10; i++) {
        const p = createPlus();
        p.position.set(
            (Math.random() - 0.5) * 0.4,
            0.2 + Math.random() * 0.3,
            (Math.random() - 0.5) * 0.2
        );
        p.rotation.z = Math.random() * Math.PI;
        aura.add(p);
    }

    aura.visible = false;
    return aura;
}

function setFaceExpression(type) {
    const face = character.userData.face;
    if (!face) return;

    const { mouth, leftEye, rightEye } = face.userData;

    switch (type) {
        case "happy":
            // 입 전체
            mouth.scale.set(0.8, 1.1, 0.8);
            mouth.rotation.z = 0;

            // ⭐ 입꼬리 더 올리기
            mouth.children[0].rotation.z = -1;   // left
            mouth.children[2].rotation.z = 1;  // right

            mouth.children[0].position.y = 0.01;
            mouth.children[2].position.y = 0.01;

            // 가운데 입 살짝 위
            mouth.children[1].scale.y = 1;
            mouth.children[1].position.y = 0.005;

            // 눈도 더 생기있게
            leftEye.scale.y = 1.1;
            rightEye.scale.y = 1.1;
            break;

        case "sad":
            // 입 전체 작게 + 아래로
            mouth.scale.set(0.8, 0.8, 0.8);
            mouth.rotation.z = 0;

            // ❌ 입꼬리 내려가기 (happy의 반대)
            mouth.children[0].rotation.z = 1;    // left ↓
            mouth.children[2].rotation.z = -1;   // right ↓

            mouth.children[0].position.y = -0.02;
            mouth.children[2].position.y = -0.02;

            // 가운데 입 아래로 + 납작
            mouth.children[1].scale.y = 0.6;
            mouth.children[1].position.y = -0.01;

            // 눈 축 처지게
            leftEye.scale.y = 0.6;
            rightEye.scale.y = 0.6;
            break;

        default: // neutral
            mouth.scale.set(1, 0.8, 1);
            mouth.rotation.z = 0;
            leftEye.scale.y = 0.9;
            rightEye.scale.y = 0.9;
    }
}

function updateExpression() {
    const { sleep } = character.userData;
    const hasGoodSleep = sleep?.plusAura?.visible;

    if (hasGoodSleep) {
        setFaceExpression("happy");
    } else {
        setFaceExpression("sad");
    }
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

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(2, 5, 3);
    scene.add(light);

    // 캐릭터 그룹
    characterRoot = new THREE.Group();
    scene.add(characterRoot);

    character = new THREE.Group();
    characterRoot.add(character);

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

    const darkCircles = createDarkCircles();
    head.add(darkCircles);

    const zzz = createZzz();
    zzz.position.set(0, 0.35, 0);
    head.add(zzz);

    const plusAura = createPlusAura();
    plusAura.position.set(0, 0.2, 0);
    head.add(plusAura);

    //얼굴
    const face = createFace();
    head.add(face);

    // 안경
    function createGlasses() {
        const glasses = new THREE.Group();

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        // 렌즈 프레임 (원형)
        function lensFrame(x) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.065, 0.008, 8, 16),
                frameMat
            );
            ring.position.set(x, 0.05, 0.235);
            return ring;
        }

        // 렌즈 2개
        const leftLens = lensFrame(-0.09);
        const rightLens = lensFrame(0.09);

        // 코 브릿지
        const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.01, 0.01),
            frameMat
        );
        bridge.position.set(0, 0.05, 0.235);

        glasses.add(leftLens, rightLens, bridge);
        glasses.visible = false;

        return glasses;
    }
    const glasses = createGlasses();
    head.add(glasses);


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

    // 📘 책 (왼손) - Group 구조
    const book = new THREE.Group();

    // 표지
    const cover = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.18, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x2563eb })
    );

    // 속지
    const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.16, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xf5f5f5 })
    );
    pages.position.z = 0.025;

    book.add(cover);
    book.add(pages);

    // 손 위치 & 각도
    book.position.set(0, -0.25, 0.18);
    book.rotation.x = -0.4;
    book.rotation.y = 0.2;

    book.visible = false;
    leftArmData.lower.add(book);

    // ✅ study 상태 저장
    character.userData.study = {
        book,
        glasses,
        leftArmData
    };

    character.userData.sleep = {
        darkCircles,
        plusAura,
        zzz
    };


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
    character.userData.head = head;
    character.userData.face = face;
    character.userData.rightArmData = rightArmData;


    character.scale.set(1.5, 1.5, 1.5);
    character.position.set(0.5, -1.2, 0);

    updateSleep(40);
    updateFinanceStatus(80);
    updateStudy(60);

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
    const { rightArmData, sleep } = character.userData;
    const { shoulder, lower } = rightArmData;

    /* ===== 팔 + 돈 ===== */
    if (financePercent >= 50) {
        money.visible = true;
        shoulder.rotation.x = -0.6;
        lower.rotation.x = -0.8;
        money.rotation.z = 0.2;

    } else {
        money.visible = false;
        shoulder.rotation.x = -0.2;
        lower.rotation.x = -0.2;

    }

    updateExpression();

}

function animate() {
    requestAnimationFrame(animate);
    characterRoot.rotation.y += 0.003;
    const sleep = character.userData.sleep;
    if (sleep?.plusAura?.visible) {
        sleep.plusAura.children.forEach((p, i) => {
            p.rotation.z += 0.01;
            p.position.y += Math.sin(Date.now() * 0.002 + i) * 0.0008;
        });
    }
    if (sleep?.zzz?.visible) {
        sleep.zzz.rotation.y += 0.01;
        sleep.zzz.position.y = 0.35 + Math.sin(Date.now() * 0.002) * 0.03;
    }
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

export function updateStudy(studyScore) {
    const study = character.userData.study;
    if (!study) return;

    const { book, glasses, leftArmData } = study;

    if (studyScore >= 50) {
        book.visible = true;
        glasses.visible = true;

        leftArmData.shoulder.rotation.x = -0.5;
        leftArmData.lower.rotation.x = -0.9;
    } else {
        book.visible = false;
        glasses.visible = false;

        leftArmData.shoulder.rotation.x = -0.2;
        leftArmData.lower.rotation.x = -0.2;
    }
}

export function updateSleep(sleepScore) {
    const sleep = character.userData.sleep;
    if (!sleep) return;

    const { darkCircles, zzz, plusAura } = sleep;

    if (sleepScore >= 50) {
        // 😊 컨디션 좋음
        plusAura.visible = true;
        darkCircles.visible = false;
        zzz.visible = false;

        // ⭐ 여기서 표정 결정
        setFaceExpression("happy");

    } else {
        // 😴 수면 부족
        plusAura.visible = false;
        darkCircles.visible = true;
        zzz.visible = true;

        setFaceExpression("tired");
    }

    updateExpression();
}



export function updateCharacterStatus({
    financeScore,
    studyScore,
    sleepScore
}) {
    updateFinance(financeScore);
    updateStudy(studyScore);
    updateSleep(sleepScore);
};