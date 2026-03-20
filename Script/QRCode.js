const QRStudio = (() => {
    const state = { qrInstances: [], logoData: "", updateTimer: null };

    const el = {
        area: document.getElementById("print-area"),
        dataInput: document.getElementById("dataInput"),
        captionInput: document.getElementById("captionInput"),
        colorMode: document.getElementById("colorMode"),
        color1: document.getElementById("color1"),
        color2: document.getElementById("color2"),
        bgColor: document.getElementById("bgColor"),
        qrEcl: document.getElementById("qrEcl"),
        captionFont: document.getElementById("captionFont"),
        sizeInput: document.getElementById("sizeInput"),
        borderWidth: document.getElementById("borderWidth"),
        boxPadding: document.getElementById("boxPadding"),
        labelGap: document.getElementById("labelGap"),
        fillSheet: document.getElementById("fillSheet"),
        borderToggle: document.getElementById("borderToggle"),
        autoUpdate: document.getElementById("autoUpdate"),
        logoInput: document.getElementById("logoInput"),
        logoPreview: document.getElementById("logoPreview"),
        btnClearLogo: document.getElementById("btnClearLogo"),
        dotStyle: document.getElementById("dotStyle"),
        eyeFrameStyle: document.getElementById("eyeFrameStyle"),
        eyeBallStyle: document.getElementById("eyeBallStyle"),
        batchPrefix: document.getElementById("batchPrefix"),
        batchStart: document.getElementById("batchStart"),
        batchEnd: document.getElementById("batchEnd"),
        btnBatch: document.getElementById("btnBatch"),
        btnReset: document.getElementById("btnReset")
    };

    const getContrast = (hex) => {
        const r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
        return ((r * 299 + g * 587 + b * 114) / 1000) > 128 ? "#000000" : "#ffffff";
    };

    const captureAsBlob = async (qrInstance, captionText, config) => {
        const { sizePx, padding, labelGap, bgColor, font } = config;
        const bWeight = el.borderToggle.checked ? (parseInt(el.borderWidth.value) || 0) : 0;
        
        const fontSizePx = 16;
        const totalWidth = sizePx + (padding * 2) + (bWeight * 2);
        const totalHeight = sizePx + padding + labelGap + fontSizePx + padding + (bWeight * 2);

        const canvas = document.createElement("canvas");
        canvas.width = totalWidth; canvas.height = totalHeight;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, totalWidth, totalHeight);
        
        if (bWeight > 0) {
            ctx.strokeStyle = "#000000"; ctx.lineWidth = bWeight;
            ctx.strokeRect(bWeight/2, bWeight/2, totalWidth - bWeight, totalHeight - bWeight);
        }

        const qrRaw = await qrInstance.getRawData("png");
        const qrImg = await new Promise(r => { const img = new Image(); img.onload = () => r(img); img.src = URL.createObjectURL(qrRaw); });
        ctx.drawImage(qrImg, padding + bWeight, padding + bWeight, sizePx, sizePx);

        ctx.fillStyle = getContrast(bgColor);
        ctx.font = `bold ${fontSizePx}px ${font}`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(captionText, totalWidth / 2, padding + bWeight + sizePx + labelGap);
        return new Promise(r => canvas.toBlob(r));
    };

    const generate = async () => {
        el.area.innerHTML = "Rendering..."; state.qrInstances = [];
        const urls = el.dataInput.value.split('\n').filter(Boolean);
        if (urls.length === 0) { el.area.innerHTML = ""; return; }
        
        const caps = el.captionInput.value.split('\n');
        const sizePx = (parseFloat(el.sizeInput.value) || 3.5) * 37.8;
        const padding = parseInt(el.boxPadding.value) || 0;
        const bWeight = parseInt(el.borderWidth.value) || 0;
        const labelGap = parseInt(el.labelGap.value) || 0;
        const bgColor = el.bgColor.value;
        const selectedFont = el.captionFont.value;

        document.documentElement.style.setProperty('--caption-font', selectedFont);
        document.body.classList.toggle('print-sheet', el.fillSheet.checked);

        const totalWidthCm = (sizePx + (padding * 2) + (bWeight * 2)) / 37.8;
        document.documentElement.style.setProperty('--print-size', `${totalWidthCm + 0.1}cm`);

        el.area.innerHTML = "";
        let list = el.fillSheet.checked ? [] : [...urls];
        if (el.fillSheet.checked) {
            const max = Math.max(1, Math.floor(18 / totalWidthCm) * Math.floor(25 / totalWidthCm));
            while (list.length < max) { list = list.concat(urls); }
            list = list.slice(0, max);
        }

        for (const [i, url] of list.entries()) {
            const currentCap = caps[i % caps.length] || caps[0] || "QR";
            const unit = document.createElement("div");
            unit.className = `qr-unit ${el.borderToggle.checked ? 'has-border' : ''}`;
            unit.style.backgroundColor = bgColor; 
            unit.style.padding = `${padding}px`;
            unit.style.borderWidth = el.borderToggle.checked ? `${bWeight}px` : '0px';

            const wrapper = document.createElement("div");
            const caption = document.createElement("div");
            caption.className = "caption-text"; caption.innerText = currentCap;
            Object.assign(caption.style, { fontWeight: "bold", fontSize: "10pt", marginTop: labelGap+"px", textAlign: "center", color: getContrast(bgColor), width: sizePx+"px" });

            const actions = document.createElement("div");
            actions.className = "no-print unit-actions";
            const dlBtn = document.createElement("button"); dlBtn.innerText = "PNG"; dlBtn.className = "btn-tiny";
            const copyBtn = document.createElement("button"); copyBtn.innerText = "Copy"; copyBtn.className = "btn-tiny btn-copy";

            unit.append(wrapper, caption, actions); actions.append(dlBtn, copyBtn); el.area.append(unit);

            const qr = new QRCodeStyling({
                width: sizePx, height: sizePx, data: url, image: state.logoData,
                qrOptions: { errorCorrectionLevel: el.qrEcl.value },
                dotsOptions: { type: el.dotStyle.value, color: el.colorMode.value === "bw" ? "#000" : el.color1.value },
                cornersSquareOptions: { type: el.eyeFrameStyle.value || el.dotStyle.value },
                cornersDotOptions: { type: el.eyeBallStyle.value || "square" },
                backgroundOptions: { color: bgColor },
                imageOptions: { margin: 2, imageSize: 0.3, crossOrigin: "anonymous" }
            });

            qr.append(wrapper);
            const config = { sizePx, padding, labelGap, bgColor, font: selectedFont };
            state.qrInstances.push({ qr, name: currentCap, config });

            dlBtn.onclick = async () => {
                const blob = await captureAsBlob(qr, currentCap, config);
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                a.download = `QR_${i}.png`; a.click();
            };

            copyBtn.onclick = async () => {
                const blob = await captureAsBlob(qr, currentCap, config);
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    copyBtn.innerText = "Copied!";
                    setTimeout(() => copyBtn.innerText = "Copy", 2000);
                } catch (err) { console.error(err); }
            };
        }
    };

    const triggerAutoUpdate = (isText = false) => {
        if (!el.autoUpdate.checked) return;
        clearTimeout(state.updateTimer);
        state.updateTimer = setTimeout(generate, isText ? 400 : 50);
    };

    const init = () => {
        el.btnBatch.onclick = () => {
            const start = parseInt(el.batchStart.value), end = parseInt(el.batchEnd.value), pre = el.batchPrefix.value;
            if (isNaN(start) || isNaN(end)) return;
            const items = []; for(let i=start; i<=end; i++) items.push(`${pre}${i}`);
            el.dataInput.value = items.join('\n'); el.captionInput.value = items.join('\n'); generate();
        };

        el.logoInput.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { 
                state.logoData = reader.result; el.logoPreview.src = reader.result;
                el.logoPreview.style.display = "block"; el.btnClearLogo.style.display = "block";
                generate(); 
            };
            reader.readAsDataURL(file);
        };

        el.btnClearLogo.onclick = () => {
            state.logoData = ""; el.logoInput.value = "";
            el.logoPreview.style.display = "none"; el.btnClearLogo.style.display = "none";
            generate();
        };

        el.btnReset.onclick = () => {
            if(!confirm("Reset all settings?")) return;
            el.dataInput.value = "https://google.com";
            el.captionInput.value = "Tag 1";
            el.colorMode.value = "gradient";
            el.color1.value = "#1e293b";
            el.color2.value = "#3b82f6";
            el.bgColor.value = "#ffffff";
            el.dotStyle.value = "rounded";
            el.qrEcl.value = "Q";
            el.captionFont.value = "system-ui, sans-serif";
            el.sizeInput.value = "3.5";
            el.borderWidth.value = "1";
            el.boxPadding.value = "10";
            el.labelGap.value = "8";
            el.fillSheet.checked = true;
            el.borderToggle.checked = true;
            el.btnClearLogo.click();
        };

        [el.colorMode, el.color1, el.color2, el.bgColor, el.qrEcl, el.dotStyle, el.eyeFrameStyle, el.eyeBallStyle, el.captionFont, el.fillSheet, el.borderToggle].forEach(input => {
            input.onchange = () => triggerAutoUpdate(false);
        });
        [el.sizeInput, el.borderWidth, el.boxPadding, el.labelGap].forEach(input => {
            input.oninput = () => triggerAutoUpdate(false);
        });
        [el.dataInput, el.captionInput].forEach(input => {
            input.oninput = () => triggerAutoUpdate(true);
        });

        document.getElementById("btnGenerate").onclick = generate;
        document.getElementById("btnPrintPDF").onclick = () => window.print();
        document.getElementById("btnExportZip").onclick = async () => {
            const zip = new JSZip();
            for (const [i, item] of state.qrInstances.entries()) {
                const blob = await captureAsBlob(item.qr, item.name, item.config);
                zip.file(`QR_${i}.png`, blob);
            }
            const content = await zip.generateAsync({type:"blob"});
            const a = document.createElement("a"); a.href = URL.createObjectURL(content);
            a.download = `QR_Collection.zip`; a.click();
        };
        generate();
    };

    return { init };
})();

QRStudio.init();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Offline support ready.'))
            .catch(err => console.log('Offline registration failed:', err));
    });
}