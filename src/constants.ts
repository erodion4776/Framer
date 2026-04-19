export const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            background: #050505;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: white;
            font-family: 'Inter', sans-serif;
            margin: 0;
            overflow: hidden;
        }
        .container {
            position: relative;
            transform-style: preserve-3d;
            perspective: 1000px;
        }
        .circle {
            width: 300px;
            height: 300px;
            background: radial-gradient(circle at 30% 30%, #00f2fe, #5b21b6);
            border-radius: 50%;
            animation: pulse-sphere 4s infinite ease-in-out;
            box-shadow: 0 0 100px rgba(0, 242, 254, 0.4);
            position: relative;
        }
        .ring {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 450px;
            height: 450px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            transform: translate(-50%, -50%) rotateX(70deg);
            animation: rotate-ring 10s infinite linear;
        }
        .ring::before {
            content: '';
            position: absolute;
            width: 10px;
            height: 10px;
            background: #00f2fe;
            border-radius: 50%;
            top: -5px;
            left: 50%;
            box-shadow: 0 0 20px #00f2fe;
        }
        @keyframes pulse-sphere {
            0%, 100% { transform: scale(1) translateY(0); box-shadow: 0 0 100px rgba(0, 242, 254, 0.4); }
            50% { transform: scale(1.1) translateY(-20px); box-shadow: 0 0 150px rgba(0, 242, 254, 0.6); }
        }
        @keyframes rotate-ring {
            from { transform: translate(-50%, -50%) rotateX(70deg) rotateZ(0deg); }
            to { transform: translate(-50%, -50%) rotateX(70deg) rotateZ(360deg); }
        }
        h1 {
            position: absolute;
            bottom: -80px;
            width: 100%;
            text-align: center;
            font-weight: 200;
            letter-spacing: 0.5em;
            text-transform: uppercase;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="circle"></div>
        <div class="ring"></div>
        <h1>Motion Studio</h1>
    </div>
</body>
</html>`;
