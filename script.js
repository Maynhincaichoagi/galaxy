// --- CẤU HÌNH CƠ BẢN ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000); 
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Alpha true để nhẹ nền
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 1. TẠO TRÁI ĐẤT (PHIÊN BẢN LOAD NHANH) ---
const textureLoader = new THREE.TextureLoader();
const earthGroup = new THREE.Group();
scene.add(earthGroup);

// Dùng MeshLambertMaterial (nhẹ hơn Phong) và ảnh độ phân giải thấp hơn
const earthGeometry = new THREE.SphereGeometry(1, 48, 48); // Giảm lưới đa giác xuống 48
const earthMaterial = new THREE.MeshLambertMaterial({
    // Ảnh chất lượng thấp hơn chút để load nhanh
    map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg'), 
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
earthGroup.add(earth);

// Ánh sáng đơn giản hóa
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x404040));

// --- 2. TẠO SAO & NGÂN HÀ (GIẢM SỐ LƯỢNG) ---
// Tạo sao nền (Starfield)
const starsGeometry = new THREE.BufferGeometry();
const starsCount = 1000; // Giảm từ 2000 -> 1000
const starsPos = new Float32Array(starsCount * 3);
for(let i=0; i<starsCount*3; i++) starsPos[i] = (Math.random() - 0.5) * 400;
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starField = new THREE.Points(starsGeometry, new THREE.PointsMaterial({color: 0xffffff, size: 0.3}));
scene.add(starField);

// Tạo Ngân Hà (Galaxy)
const galaxyGroup = new THREE.Group();
galaxyGroup.position.z = -50; 
scene.add(galaxyGroup);

// Giảm số lượng hạt ngân hà để khởi tạo nhanh
const galaxyParams = {
    count: 10000, // Giảm từ 30.000 -> 10.000 (Load cực lẹ)
    size: 0.15,
    radius: 30,
    branches: 3,
    spin: 1,
    randomness: 0.5,
    insideColor: '#ff6030',
    outsideColor: '#1b3984'
};

const generateGalaxy = () => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(galaxyParams.count * 3);
    const colors = new Float32Array(galaxyParams.count * 3);
    const colorInside = new THREE.Color(galaxyParams.insideColor);
    const colorOutside = new THREE.Color(galaxyParams.outsideColor);

    for(let i = 0; i < galaxyParams.count; i++) {
        const i3 = i * 3;
        const radius = Math.random() * galaxyParams.radius;
        const spinAngle = radius * galaxyParams.spin;
        const branchAngle = (i % galaxyParams.branches) / galaxyParams.branches * Math.PI * 2;
        
        // Tính toán tọa độ đơn giản hơn
        const randomX = (Math.random()-0.5) * galaxyParams.randomness * radius;
        const randomY = (Math.random()-0.5) * galaxyParams.randomness * radius * 0.5; 
        const randomZ = (Math.random()-0.5) * galaxyParams.randomness * radius;

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3+1] = randomY;
        positions[i3+2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        const mixedColor = colorInside.clone();
        mixedColor.lerp(colorOutside, radius / galaxyParams.radius);
        colors[i3] = mixedColor.r; colors[i3+1] = mixedColor.g; colors[i3+2] = mixedColor.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: galaxyParams.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });
    galaxyGroup.add(new THREE.Points(geometry, material));
};
generateGalaxy();

// --- 3. XỬ LÝ MEDIAPIPE (TỐI ƯU HÓA) ---
let targetZ = 3; 
const MIN_Z = 2.5; 
const MAX_Z = 100;

const loadingDiv = document.getElementById('loading');
const videoElement = document.getElementsByClassName('input_video')[0];

function onResults(results) {
    // Ẩn loading ngay khi có frame đầu tiên
    if(loadingDiv.style.display !== 'none') {
        loadingDiv.style.opacity = 0;
        setTimeout(() => { loadingDiv.style.display = 'none'; }, 500);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));

        const sensitivity = 5; 
        let normalizedDist = (distance * sensitivity); 
        if (normalizedDist > 1) normalizedDist = 1; 
        targetZ = MIN_Z + (MAX_Z - MIN_Z) * normalizedDist;
    }
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

// --- CẤU HÌNH QUAN TRỌNG ĐỂ CHẠY NHANH ---
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0, // <--- 0 LÀ BẢN LITE (SIÊU NHẸ), 1 LÀ FULL
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Khởi động Camera
const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 320, // <--- Giảm độ phân giải xử lý đầu vào (càng nhỏ càng nhanh)
    height: 240
});
cameraUtils.start();

// --- 4. ANIMATION LOOP ---
camera.position.z = MIN_Z; 
const tick = () => {
    earth.rotation.y += 0.002;
    galaxyGroup.rotation.y += 0.0005;
    camera.position.z += (targetZ - camera.position.z) * 0.1; // Tăng tốc độ camera đuổi theo tay (0.05 -> 0.1)

    if (camera.position.z > 20) galaxyGroup.visible = true; 
    
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
};
tick();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});