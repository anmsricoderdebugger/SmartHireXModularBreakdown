// ══════════ CV SCREENING ══════════
const listify = (arr) => {
    if (!arr || arr.length === 0) return '';
    const filtered = arr.filter(i => i && i.trim().toLowerCase() !== 'none');
    if (filtered.length === 0) return '';
    return filtered.map(i => {
        const colonIdx = i.indexOf(':');
        if (colonIdx > 0 && colonIdx < 40) {
            const label = i.substring(0, colonIdx).trim();
            const desc = i.substring(colonIdx + 1).trim();
            return `<li><strong>${label}:</strong> ${desc}</li>`;
        }
        return `<li>${i}</li>`;
    }).join('');
};

let allCVResults = [];
let allATSResults = [];

let selectedManualThreshold = 70;
let selectedATSThreshold = 70;

// function openJDModal(htmlContent) {
//     document.getElementById("jdContent").innerHTML = htmlContent;
//     document.getElementById("jdModal").style.display = "block";
// }

function openJDModal(html) {
    if (!html) {
        showModal("JD Not Available", "Job description is not available.");
        return;
    }

    document.getElementById("jdContent").innerHTML = html;
    document.getElementById("jdModal").style.display = "flex";
}

function closeJDModal() {
    document.getElementById("jdModal").style.display = "none";
}

function openATSChoiceModal() {
    const modal = document.getElementById("atsChoiceModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closeATSChoiceModal() {
    const modal = document.getElementById("atsChoiceModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function startATSAfterChoice(type) {
    closeATSChoiceModal();
    runCVScreeningATS(type);
}

function sendSingleCandidateSMS(candidateName, phone, score, type) {

    console.log("SMS type Received:", type);
    const threshold = getWhatsAppThreshold(type);
    console.log("Final Threshold Value:", threshold);
    const numericScore = Number(score || 0);

    if (!phone || phone.trim() === "") {

        showModal(
            "Phone Number Missing",
            `Phone number is not available for ${candidateName}.`
        );

        return;
    }

    const sendMessage = () => {

        closeSMSConfirmModal();

        showModal(
            "WhatsApp Message Sent",
            `WhatsApp message has been sent to ${candidateName}: ${phone}`
        );
    };

    // BELOW THRESHOLD
    if (numericScore < threshold) {
        console.log("=========>"+threshold)

        const modal = document.getElementById("smsConfirmModal");

        const text = document.getElementById("smsConfirmText");

        const proceedBtn = document.getElementById("confirmSMSProceedBtn");

        text.innerHTML =
            `${candidateName} has scored below the selected threshold score of <b>${threshold}%</b>.<br><br>Do you still want to send the WhatsApp message?`;

        proceedBtn.onclick = sendMessage;

        modal.style.display = "flex";

        return;
    }

    // ABOVE THRESHOLD
    sendMessage();
}

// async function sendSMS(phone, candidateName, score) {
//     if (!phone || phone.trim() === '') {
//         alert(`No phone number found for ${candidateName}`);
//         return;
//     }

//     if (Number(score || 0) < 70) {
//         alert("WhatsApp screening is allowed only for candidates with score 70 or above.");
//         return;
//     }

//     const jobTitle = "the role";

//     try {
//         const response = await fetch('/api/send-whatsapp', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({
//                 candidate_name: candidateName,
//                 phone_number: phone,
//                 job_title: jobTitle,
//                 score: score
//             })
//         });

//         const data = await response.json();

//         if (data.success) {
//             alert(`WhatsApp message sent successfully to ${candidateName}`);
//         } else {
//             alert(`Failed: ${data.error || 'Unknown error'}`);
//         }

//     } catch (error) {
//         alert(`Something went wrong: ${error.message}`);
//     }
// }

function ratingStars(value) {
    const n = Math.max(0, Math.min(5, Number(value || 0)));
    return "★".repeat(n) + "☆".repeat(5 - n);
}

function ratingBox(label, value) {
    return `
        <div class="rating-box">
            <label>${label}</label>
            <div class="stars">${ratingStars(value)}</div>
        </div>
    `;
}

function fitLabel(score) {
    if (score >= 75) return { text: 'Strong Fit', cls: 'fit-strong' };
    if (score >= 60) return { text: 'Good Fit', cls: 'fit-good' };
    if (score >= 45) return { text: 'Borderline', cls: 'fit-mid' };
    return { text: 'Low Fit', cls: 'fit-low' };
}

function topItems(arr, max = 2) {
    if (!arr || arr.length === 0) {
        return '<span class="muted">No clear evidence</span>';
    }

    return arr
        .filter(Boolean)
        .slice(0, max)
        .map(x => `<span class="mini-pill">${x}</span>`)
        .join("");
}

function getFallbackRatings(d) {
    const score = Number(d.overallScore || 0);

    // return {
    //     jd_match: Math.ceil(score / 20),
    //     skills: d.strengths?.Experience_Alignment?.length ? 4 : 2,
    //     experience: d.gaps?.Functional_Gaps?.length ? 2 : 4,
    //     projects: d.strengths?.Projects_and_Quantifiable_Impact?.length ? 4 : 2,
    //     education: d.strengths?.NIRF_and_Pedigree?.length ? 4 : 2
    // };

    return {
        jd_match: Math.ceil(score / 20),
        skills: d.strengths?.Experience_Alignment?.length ? 5 : Math.ceil(score / 20),
        experience: d.gaps?.Functional_Gaps?.length ? 3 : Math.ceil(score / 20),
        projects: d.strengths?.Projects_and_Quantifiable_Impact?.length ? 4 : Math.ceil(score / 20),
        education: d.strengths?.NIRF_and_Pedigree?.length ? 4 : 3
    };
}


function updateThresholdValue(value, type) {
    // const valueId = type === "ats" ? "atsThresholdValue" : "thresholdValue";
    // const el = document.getElementById(valueId);

    // if (el) {
    //     el.innerText = value + "%";
    // }

    const numericValue = Number(value);

    // MANUAL
    if (type === "manual") {

        selectedManualThreshold = numericValue;

        const label = document.getElementById("manualThresholdValue");

        if (label) {
            label.innerText = numericValue + "%";
        }

        console.log("Manual Threshold Updated:", selectedManualThreshold);
    }

    // ATS
    else {

        selectedATSThreshold = numericValue;

        const label = document.getElementById("atsThresholdValue");

        if (label) {
            label.innerText = numericValue + "%";
        }

        console.log("ATS Threshold Updated:", selectedATSThreshold);
    }
}

function activateScoreSlider(type = "manual") {
    const boxId = type === "ats" ? "atsSliderBox" : "manualSliderBox";
    const sliderId = type === "ats" ? "atsScoreThreshold" : "scoreThreshold";

    const box = document.getElementById(boxId);
    const slider = document.getElementById(sliderId);

    if (box) box.style.display = "block";
    if (slider) slider.disabled = false;
}

function getSelectedThresholdScore(type = "manual") {
    const sliderId = type === "ats" ? "atsScoreThreshold" : "scoreThreshold";
    const slider = document.getElementById(sliderId);

    return Number(slider ? slider.value : 70);
}

function sendSMS(phone, candidateName, score, type = "manual") {
    const thresholdScore = getSelectedThresholdScore(type);

    if (!phone || phone.trim() === "") {
        alert(`No phone number found for ${candidateName}`);
        return;
    }

    if (Number(score || 0) < thresholdScore) {
        alert(`${candidateName} score is below selected threshold ${thresholdScore}%.`);
        return;
    }

    alert(`Message sent to ${candidateName}: ${phone}`);
}


function showAutoMessagePopup(results, type = "manual") {
    const thresholdScore = getSelectedThresholdScore(type);

    const selectedCandidates = (results || []).filter(candidate => {
        const score = Number(candidate.overallScore || candidate.score || 0);

        const phone =
            candidate.phone_number ||
            candidate.phone ||
            candidate.mobile ||
            "";

        return score >= thresholdScore && phone;
    });

    if (selectedCandidates.length === 0) {
        return;
    }

    const popupLines = selectedCandidates.map(candidate => {
        const name = candidate.candidate_name || "Candidate";

        const phone =
            candidate.phone_number ||
            candidate.phone ||
            candidate.mobile ||
            "Phone not found";

        return `Message sent to ${name}: ${phone}`;
    });

    alert(popupLines.join("\n"));
}


// function showWhatsAppButton(type) {
//     const btnId = type === "ats" ? "atsWhatsappBtn" : "manualWhatsappBtn";
//     const btn = document.getElementById(btnId);

//     if (btn) {
//         btn.style.display = "inline-block";
//     }
// }


function showWhatsAppButton(type) {
    const btnId = type === "ats" ? "atsWhatsappBtn" : "manualWhatsappBtn";
    const btn = document.getElementById(btnId);

    if (btn) {
        btn.style.display = "inline-flex";
        btn.style.visibility = "visible";
        btn.disabled = false;
    } else {
        console.error("WhatsApp button not found:", btnId);
    }
}


function toggleWhatsAppPanel(type) {
    const panelId = type === 'ats' ? "atsWhatsappPanel" : "manualWhatsappPanel";
    const panel = document.getElementById(panelId);

    if (!panel) return;

    panel.style.display = panel.style.display === "none" ? "block" : "none";
}

// function updateWhatsAppThreshold(value, type="manual") {
//     const valueId = type === "ats" ? "atsThresholdValue" : "manualThresholdValue";
//     const valueEl = document.getElementById(valueId);

//     if (valueEl) {
//         valueEl.innerText = value + "%";
//     }
// }

function updateWhatsAppThreshold(value, type) {
    
    const numericValue = Number(value);

    if (type === "ats") {
        selectedATSThreshold = numericValue;

        const label = document.getElementById("atsThresholdValue");
        if (label) label.innerText = numericValue + "%";

        console.log("ATS Threshold Updated:", selectedATSThreshold);
    } else {
        selectedManualThreshold = numericValue;

        const label = document.getElementById("manualThresholdValue");
        if (label) label.innerText = numericValue + "%";

        console.log("Manual Threshold Updated:", selectedManualThreshold);
    }
    // const labelId = type === 'ats'
    //     ? "atsThresholdValue"
    //     : "manualThresholdValue";

    // const label = document.getElementById(labelId);

    // if (label) {
    //     label.innerText = value + "%";
    // }

    // console.log("Updated Threshold:", type, value);

}

// function getWhatsAppThreshold(type="manual") {
//     const sliderId = type === "ats" ? "atsScoreThreshold" : "manualScoreThreshold";
//     const slider = document.getElementById(sliderId);

//     console.log("Slider Type:", type);
//     console.log("Slider ID:", sliderId);
//     console.log("Slider Element:", slider);

//     if(!slider){
//         return 70;
//     }
//     return Number(slider.value);
// }

// function getWhatsAppThreshold(type = "manual") {
//     // const sliderId = type === "ats" ? "atsScoreThreshold" : "manualScoreThreshold";
//     // const slider = document.getElementById(sliderId);

//     // if (!slider) {
//     //     console.warn("Threshold slider not found:", sliderId);
//     //     return 70;
//     // }

//     // console.log("Threshold Type:", type);
//     // console.log("Slider ID:", sliderId);
//     // console.log("Current Slider Value:", slider.value);

//     // return Number(slider.value);

//     if (type === "ats") {
//         return selectedATSThreshold;
//     }

//     return selectedManualThreshold;
// }


function getWhatsAppThreshold(type) {

    // const valueId =
    //     type === 'ats'
    //         ? "atsThresholdValue"
    //         : "manualThresholdValue";
    // console.log("+++++"+type)        
    // console.log(document.getElementById(valueId));
    // const element = document.getElementById(valueId);

    // if (!element) {
    //     console.warn("Threshold element not found:", valueId);
    //     return 70;
    // }

    // // Example: "58%" → 58
    // const value = Number(
    //     element.innerText.replace("%", "").trim()
    // );

    // console.log("Threshold Type:", type);
    // console.log("Threshold Value:", value);

    // return value;

    return type === "ats" ? selectedATSThreshold : selectedManualThreshold;
}


function closeSMSConfirmModal() {

    const modal = document.getElementById("smsConfirmModal");

    if (modal) {
        modal.style.display = "none";
    }
}

function sendThresholdMessages(type) {
    const results = type === "ats" ? allATSResults : allCVResults;
    const threshold = getWhatsAppThreshold(type);

    const selectedCandidates = (results || []).filter(candidate => {
        const score = Number(candidate.overallScore || candidate.score || 0);

        const phone =
            candidate.phone_number ||
            candidate.phone ||
            candidate.mobile ||
            "";

        return score >= threshold && phone;
    });

    if (selectedCandidates.length === 0) {
        showModal(
            "No Candidates Found",
            `No candidate found with score greater than or equal to ${threshold}% and phone number available.`
        );
        return;
    }

    const messageLines = selectedCandidates.map(candidate => {
        const name = candidate.candidate_name || "Candidate";

        const phone =
            candidate.phone_number ||
            candidate.phone ||
            candidate.mobile ||
            "Phone not found";

        return `Message sent to ${name}: ${phone}`;
    });

    showModal("WhatsApp Message Status", messageLines.join("------"));
}



// async function runCVScreeningManual() {
//     const jdFile = document.getElementById('cvJdFileInput').files[0];
//     const cvFiles = Array.from(document.getElementById('cvFilesInput').files);
//     const notes = document.getElementById('cvScreeningNotes').value;

//     // In cv-parser.js — replace the validation block at the top of runCVScreening

//     if (!jdFile || cvFiles.length === 0) { alert("Please upload a JD and at least one CV."); return; }

//     // Block unsupported formats
//     const allowedExts = ['.pdf', '.docx', '.doc'];
//     const blockedCheck = (f) => !allowedExts.some(ext => f.name.toLowerCase().endsWith(ext));

//     if (blockedCheck(jdFile)) {
//         showModal('❌ Unsupported Format', `"${jdFile.name}" is not supported. Only PDF, DOCX, and DOC files are accepted for JD upload.`);
//         return;
//     }
//     const invalidCVs = cvFiles.filter(blockedCheck);
//     if (invalidCVs.length > 0) {
//         showModal('❌ Unsupported Format', `These files are not supported:\n${invalidCVs.map(f => f.name).join(', ')}\n\nOnly PDF, DOCX, and DOC files are accepted.`);
//         return;
//     }

//     const container = document.getElementById('cvResultsContainer');
//     const loader = document.getElementById('cvResultsLoading');
//     const downloadBtn = document.getElementById('cvDownloadBtn');

//     // In cv-parser.js — replace the section inside runCVScreening from "document.getElementById('cvScreeningResults')" onwards

//     document.getElementById('cvScreeningResults').style.display = 'block';
//     loader.style.display = 'flex';
//     downloadBtn.style.display = 'none';
//     container.innerHTML = '';
//     allCVResults = [];

//     // Show processing counter
//     const totalCount = cvFiles.length;
//     let processedCount = 0;
//     loader.innerHTML = `<div class="spinner"></div><span id="cvProgressText">Processing 0 of ${totalCount} candidates...</span>`;

//     for (const file of cvFiles) {
//         const fd = new FormData();
//         fd.append('jd', jdFile);
//         fd.append('cv', file);
//         fd.append('notes', notes);

//         let attempts = 0;
//         let success = false;

//         while (attempts < 2 && !success) {
//             try {
//                 const response = await fetch('/api/screen/manual', { method: 'POST', body: fd });
//                 const res = await response.json();

//                 if (res.success) {
//                     allCVResults.push(res.data);
//                     renderCVCard(res.data, container);
//                     success = true;
//                 } else {
//                     if (res.error.includes('blank document') || res.error.includes('only images')) {
//                         showModal('⚠️ File Issue', `${file.name}: ${res.error}`);
//                         break;
//                     }
//                     if (res.error.includes('not supported') || res.error.includes('Only PDF')) {
//                         showModal('❌ Unsupported Format', res.error);
//                         break;
//                     }
//                     throw new Error(res.error);
//                 }
//             } catch (e) {
//                 attempts++;
//                 if (attempts >= 2) {
//                     renderCVCard({ candidate_name: file.name, overallScore: 0, recommendation: "Processing Failed", rationale: `Error: ${e.message}`, failed: true, strengths: {}, gaps: {}, proximity_matches: [] }, container);
//                 } else {
//                     await new Promise(r => setTimeout(r, 2000));
//                 }
//             }
//         }
//         processedCount++;
//         document.getElementById('cvProgressText').textContent = `Processed ${processedCount} of ${totalCount} candidates...`;
//         await new Promise(r => setTimeout(r, 2000));
//     }
//     container.innerHTML = '';
//     allCVResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
//     allCVResults.forEach(d => renderCVCard(d, container, "manual"));
//     activateScoreSlider("manual");

//     // Hide loader and show download button
//     loader.style.display = 'none';
    
//     if (allCVResults.length > 0) {
//         downloadBtn.style.display = 'block';
//         downloadBtn.innerText = `📥 Download Audit Report (${allCVResults.length} Candidates)`;
//     }
// }

// async function runCVScreeningManual() {
//     const jdFile = document.getElementById('cvJdFileInput').files[0];
//     const cvFiles = Array.from(document.getElementById('cvFilesInput').files);
//     const notes = document.getElementById('cvScreeningNotes').value;

//     if (!jdFile || cvFiles.length === 0) {
//         alert("Please upload a JD and at least one CV.");
//         return;
//     }

//     const allowedExts = ['.pdf', '.docx', '.doc'];
//     const blockedCheck = (f) =>
//         !allowedExts.some(ext => f.name.toLowerCase().endsWith(ext));

//     if (blockedCheck(jdFile)) {
//         showModal('❌ Unsupported Format', `"${jdFile.name}" is not supported.`);
//         return;
//     }

//     const invalidCVs = cvFiles.filter(blockedCheck);
//     if (invalidCVs.length > 0) {
//         showModal(
//             '❌ Unsupported Format',
//             `These files are not supported:\n${invalidCVs.map(f => f.name).join(', ')}`
//         );
//         return;
//     }

//     const container = document.getElementById('cvResultsContainer');
//     const loader = document.getElementById('cvResultsLoading');
//     const downloadBtn = document.getElementById('cvDownloadBtn');

//     document.getElementById('cvScreeningResults').style.display = 'block';
//     loader.style.display = 'flex';
//     downloadBtn.style.display = 'none';
//     container.innerHTML = '';
//     // allCVResults = [];

//     const totalCount = cvFiles.length;
//     let processedCount = 0;

//     loader.innerHTML = `
//         <div class="spinner"></div>
//         <span id="cvProgressText">Processing 0 of ${totalCount} candidates...</span>
//     `;

//     async function processSingleCV(file) {
//         const fd = new FormData();
//         fd.append('jd', jdFile);
//         fd.append('cv', file);
//         fd.append('notes', notes);

//         try {
//             const response = await fetch('/api/screen/manual', {
//                 method: 'POST',
//                 body: fd
//             });

//             const res = await response.json();

//             if (res.success) {
//                 return res.data;
//             }

//             return {
//                 candidate_name: file.name,
//                 overallScore: 0,
//                 recommendation: "Processing Failed",
//                 rationale: res.error || "Unknown error",
//                 failed: true,
//                 strengths: {},
//                 gaps: {},
//                 proximity_matches: []
//             };

//         } catch (error) {
//             return {
//                 candidate_name: file.name,
//                 overallScore: 0,
//                 recommendation: "Processing Failed",
//                 rationale: `Error: ${error.message}`,
//                 failed: true,
//                 strengths: {},
//                 gaps: {},
//                 proximity_matches: []
//             };
//         } finally {
//             processedCount++;

//             const progressText = document.getElementById('cvProgressText');
//             if (progressText) {
//                 progressText.textContent =
//                     `Processed ${processedCount} of ${totalCount} candidates...`;
//             }
//         }
//     }

//     const CONCURRENCY_LIMIT = 3;
//     const results = [];

//     for (let i = 0; i < cvFiles.length; i += CONCURRENCY_LIMIT) {
//         const batch = cvFiles.slice(i, i + CONCURRENCY_LIMIT);

//         const batchResults = await Promise.all(
//             batch.map(file => processSingleCV(file))
//         );

//         results.push(...batchResults);

//         container.innerHTML = '';
//         results
//             .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
//             .forEach(d => renderCVCard(d, container, "manual"));
//     }

//     allCVResults = results.sort(
//         (a, b) => (b.overallScore || 0) - (a.overallScore || 0)
//     );

//     container.innerHTML = '';
//     allCVResults.forEach(d => renderCVCard(d, container, "manual"));

//     showWhatsAppButton("manual");
//     loader.style.display = 'none';

//     if (allCVResults.length > 0) {
//         downloadBtn.style.display = 'block';
//         downloadBtn.innerText =
//             `📥 Download Audit Report (${allCVResults.length} Candidates)`;
//     }
// }


async function downloadATSReport() {

    const btn = document.getElementById('atsDownloadBtn');

    btn.innerHTML = "⌛ Generating Report...";
    btn.disabled = true;

    try {

        const res = await fetch('/api/cv/download-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                results: allATSResults
            })
        });

        if (!res.ok) {

            const err = await res.json();

            showModal(
                "Download Failed",
                err.error || "Unable to generate ATS report."
            );

            return;
        }

        const blob = await res.blob();

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');

        a.href = url;

        a.download =
            'ATS_Candidate_Report_' +
            new Date().toISOString().slice(0, 10) +
            '.docx';

        a.click();

        URL.revokeObjectURL(url);

    } catch (err) {

        showModal(
            "Download Error",
            err.message
        );

    } finally {

        btn.innerHTML =
            '📥 Download ATS Report (' +
            allATSResults.length +
            ' Candidates)';

        btn.disabled = false;
    }
}

async function runCVScreeningManual() {
    const jdFile = document.getElementById('cvJdFileInput').files[0];
    const cvFiles = Array.from(document.getElementById('cvFilesInput').files);
    const notes = document.getElementById('cvScreeningNotes').value;

    if (!jdFile || cvFiles.length === 0) {
        showModal('⚠️ Missing Files', 'Please upload a JD and at least one CV.');
        return;
    }

    const allowedExts = ['.pdf', '.docx', '.doc'];
    const blockedCheck = (f) => !allowedExts.some(ext => f.name.toLowerCase().endsWith(ext));

    if (blockedCheck(jdFile)) {
        showModal('❌ Unsupported Format', `"${jdFile.name}" is not supported. Only PDF, DOCX, and DOC files are accepted.`);
        return;
    }

    const invalidCVs = cvFiles.filter(blockedCheck);
    if (invalidCVs.length > 0) {
        showModal(
            '❌ Unsupported Format',
            `These files are not supported:\n${invalidCVs.map(f => f.name).join(', ')}`
        );
        return;
    }

    const container = document.getElementById('cvResultsContainer');
    const loader = document.getElementById('cvResultsLoading');
    const downloadBtn = document.getElementById('cvDownloadBtn');

    document.getElementById('cvScreeningResults').style.display = 'block';
    loader.style.display = 'flex';
    container.innerHTML = '';
    downloadBtn.style.display = 'none';
    allCVResults = [];

    try {
        loader.innerHTML = `<div class="spinner"></div><span>Reading JD...</span>`;

        const initForm = new FormData();
        initForm.append('jd', jdFile);
        initForm.append('notes', notes);

        const initResponse = await fetch('/api/screen/manual/init', {
            method: 'POST',
            body: initForm
        });

        const initData = await initResponse.json();

        if (!initData.success) {
            showModal('❌ Manual Screening Failed', initData.error || 'JD processing failed.');
            return;
        }

        renderManualLiveResults(container, allCVResults, cvFiles.length);

        loader.innerHTML = `<div class="spinner"></div><span>Screening 0/${cvFiles.length} candidates...</span>`;

        const finalResults = await promisePool(cvFiles, 4, async (cvFile, currentIndex) => {
            const formData = new FormData();
            formData.append('cv', cvFile);
            formData.append('candidate_id', currentIndex + 1);

            const response = await fetch('/api/screen/manual/evaluate', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Candidate screening failed');
            }

            allCVResults.push(data.result);
            allCVResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

            loader.innerHTML = `
                <div class="spinner"></div>
                <span>Screening ${allCVResults.length}/${cvFiles.length} candidates...</span>
            `;

            renderManualLiveResults(container, allCVResults, cvFiles.length);

            return data.result;
        });

        allCVResults = finalResults.filter(Boolean);
        allCVResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

        // renderManualLiveResults(container, allCVResults, cvFiles.length);

        // if (allCVResults.length > 0) {
        //     downloadBtn.style.display = 'block';
        //     downloadBtn.innerText = `📥 Download Audit Report (${allCVResults.length} Candidates)`;
        // }

        renderManualLiveResults(container, allCVResults, cvFiles.length);

        if (allCVResults.length > 0) {
            downloadBtn.style.display = 'block';
            downloadBtn.innerText = `📥 Download Audit Report (${allCVResults.length} Candidates)`;

            showWhatsAppButton("manual");
        }

    } catch (err) {
        showModal('❌ Error', err.message);
    } finally {
        loader.style.display = 'none';
    }
}


function renderManualLiveResults(container, results, totalCandidates) {
    container.innerHTML = '';

    container.insertAdjacentHTML('beforeend', `
        <div class="ats-progress-box">
            <div class="ats-progress-top">
                <b>Manual CV Screening Progress</b>
                <span>${results.length}/${totalCandidates}</span>
            </div>
            <div class="ats-progress-bar">
                <div style="width:${Math.round((results.length / totalCandidates) * 100)}%"></div>
            </div>
        </div>
    `);

    renderCVSummary(results, container);
    results.forEach(r => renderCVCard(r, container,'manual'));
}


function renderATSLiveResults(container, results, totalCandidates) {
    container.innerHTML = '';

    container.insertAdjacentHTML('beforeend', `
        <div class="ats-progress-box">
            <div class="ats-progress-top">
                <b>ATS Screening Progress</b>
                <span>${results.length}/${totalCandidates}</span>
            </div>
            <div class="ats-progress-bar">
                <div style="width:${Math.round((results.length / totalCandidates) * 100)}%"></div>
            </div>
        </div>
    `);

    if (typeof renderCVSummary === "function") {
        renderCVSummary(results, container);
    }

    results.forEach(r => renderCVCard(r, container,'ats'));
}



// async function runCVScreeningATS() {
//     const notes = document.getElementById('atsScreeningNotes').value;
//     const jobCode = document.getElementById('jobCodeInput').value.trim();

//     if (!jobCode) {
//         showModal('⚠️ Missing Job Code', 'Please enter a valid CEIPAL job code.');
//         return;
//     }

//     const resultsBox = document.getElementById('atsScreeningResults');
//     const container = document.getElementById('atsResultsContainer');
//     const loader = document.getElementById('atsResultsLoading');

//     resultsBox.style.display = 'block';
//     loader.style.display = 'flex';
//     container.innerHTML = '';

//     try {
//         const response = await fetch('/api/screen/ats', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 notes: notes,
//                 job_code: jobCode
//             })
//         });

//         const data = await response.json();
//         console.log("ATS Response:", data);

//         if (!data.success) {
//             showModal('❌ ATS Screening Failed', data.error || 'Something went wrong.');
//             return;
//         }

//         if (data.job_description_html) {
//             openJDModal(data.job_description_html);
//         }

//         const results = data.results || [];

//         if (results.length === 0) {
//             container.innerHTML = `
//                 <div class="cv-result-card">
//                     <h3>No candidates found</h3>
//                     <p>No submissions were returned from CEIPAL for this job code.</p>
//                 </div>
//             `;
//             return;
//         }

//         results.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
//         results.forEach(r => renderCVCard(r, container, "ats"));
//         activateScoreSlider("ats");

//     } catch (err) {
//         showModal('❌ Error', err.message);
//     } finally {
//         loader.style.display = 'none';
//     }
// }

// async function runCVScreeningATS() {
//     const notes = document.getElementById('atsScreeningNotes').value;
//     const jobCode = document.getElementById('jobCodeInput').value.trim();

//     if (!jobCode) {
//         showModal('⚠️ Missing Job Code', 'Please enter a valid CEIPAL job code.');
//         return;
//     }

//     const resultsBox = document.getElementById('atsScreeningResults');
//     const container = document.getElementById('atsResultsContainer');
//     const loader = document.getElementById('atsResultsLoading');

//     resultsBox.style.display = 'block';
//     loader.style.display = 'flex';
//     container.innerHTML = '';

//     loader.innerHTML = `
//         <div class="spinner"></div>
//         <span id="atsProgressText">Fetching candidates from CEIPAL...</span>
//     `;

//     try {
//         const response = await fetch('/api/screen/ats', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 notes: notes,
//                 job_code: jobCode
//             })
//         });

//         const data = await response.json();
//         console.log("ATS Response:", data);

//         if (!data.success) {
//             showModal('❌ ATS Screening Failed', data.error || 'Something went wrong.');
//             return;
//         }

//         if (data.job_description_html) {
//             openJDModal(data.job_description_html);
//         }

//         const results = data.results || [];

//         if (results.length === 0) {
//             container.innerHTML = `
//                 <div class="cv-result-card">
//                     <h3>No candidates found</h3>
//                     <p>No submissions were returned from CEIPAL for this job code.</p>
//                 </div>
//             `;
//             return;
//         }

//         const progressText = document.getElementById('atsProgressText');
//         if (progressText) {
//             progressText.textContent = `Rendering ${results.length} screened candidates...`;
//         }

//         const sortedResults = results.sort(
//             (a, b) => (b.overallScore || 0) - (a.overallScore || 0)
//         );

//         allATSResults = sortedResults;

//         container.innerHTML = '';

//         sortedResults.forEach((r, index) => {
//             renderCVCard(r, container, "ats");

//             const progressText = document.getElementById('atsProgressText');
//             if (progressText) {
//                 progressText.textContent =
//                     `Rendered ${index + 1} of ${sortedResults.length} candidates...`;
//             }
//         });

//         showWhatsAppButton("ats");

//     } 
//     catch (err) {
//         showModal('❌ Error', err.message);
//     } finally {
//         loader.style.display = 'none';
//     }
// }


async function runCVScreeningATS(screeningType) {
    const notes = document.getElementById('atsScreeningNotes').value;
    const jobCode = document.getElementById('jobCodeInput').value.trim();

    if (!jobCode) {
        showModal('⚠️ Missing Job Code', 'Please enter a valid CEIPAL job code.');
        return;
    }

    const resultsBox = document.getElementById('atsScreeningResults');
    const container = document.getElementById('atsResultsContainer');
    const loader = document.getElementById('atsResultsLoading');

    resultsBox.style.display = 'block';
    loader.style.display = 'flex';
    container.innerHTML = '';

    try {
        loader.innerHTML = `
            <div class="spinner"></div>
            <span>Fetching ATS candidates from CEIPAL...</span>
        `;

        const initResponse = await fetch('/api/screen/ats/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                notes: notes,
                job_code: jobCode,
                screening_type: screeningType
            })
        });

        const initData = await initResponse.json();
        console.log("ATS Init Response:", initData);

        if (!initData.success) {
            showModal('❌ ATS Screening Failed', initData.error || 'Something went wrong.');
            return;
        }

        // if (initData.job_description_html) {
        //     openJDModal(initData.job_description_html);
        // }

        if (initData.job_description_html) {
            currentATSJDHtml = initData.job_description_html;

            const jdBtn = document.getElementById("atsViewJDBtn");
            if (jdBtn) {
                jdBtn.style.display = "inline-flex";
            }
        }

        
        const candidates = initData.candidates || [];

        if (candidates.length === 0) {
            container.innerHTML = `
                <div class="cv-result-card">
                    <h3>No candidates found</h3>
                    <p>No submissions were returned from CEIPAL for this job code.</p>
                </div>
            `;
            return;
        }

        let atsResults = [];

        renderATSLiveResults(container, atsResults, candidates.length);

        loader.innerHTML = `
            <div class="spinner"></div>
            <span>Screening 0/${candidates.length} candidates...</span>
        `;

        // const finalResults = await promisePool(candidates, 4, async (candidate) => {
        //     const response = await fetch('/api/screen/ats/evaluate', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' },
        //         //body: JSON.stringify(candidate)
        //         body: JSON.stringify({
        //             submission_id: candidate.submission_id,
        //             candidate_name: candidate.candidate_name,
        //             resume: candidate.resume,
        //             resume_url: candidate.resume_url,
        //             access_token: candidate.access_token,
        //             jd_text: candidate.jd_text,
        //             notes: candidate.notes
        //         })
        //     });

        //     const data = await response.json();

        //     if (!data.success) {
        //         throw new Error(data.error || 'Candidate screening failed');
        //     }

        //     atsResults.push(data.result);
        //     atsResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

        //     loader.innerHTML = `
        //         <div class="spinner"></div>
        //         <span>Screening ${atsResults.length}/${candidates.length} candidates...</span>
        //     `;

        //     renderATSLiveResults(container, atsResults, candidates.length);

        //     return data.result;
        // });

        // // atsResults = finalResults.filter(Boolean);
        // // atsResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

        // // renderATSLiveResults(container, atsResults, candidates.length);

        // atsResults = finalResults.filter(Boolean);
        // atsResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

        // allATSResults = atsResults;

        // renderATSLiveResults(container, allATSResults, candidates.length);

        const finalResults = await promisePool(candidates, 4, async (candidate) => {
        const response = await fetch('/api/screen/ats/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submission_id: candidate.submission_id,
                candidate_name: candidate.candidate_name,
                resume: candidate.resume,
                resume_url: candidate.resume_url,
                access_token: candidate.access_token,
                jd_text: candidate.jd_text,
                notes: candidate.notes
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Candidate screening failed');
        }

        const result = data.result;

        const failedStatuses = [
            "Download Failed",
            "Resume Missing",
            "Token Missing",
            "Unreadable"
        ];

        if (failedStatuses.includes(result.recommendation)) {
            console.warn(
                "Skipping failed ATS candidate:",
                result.candidate_name,
                result.recommendation
            );

            return null;
        }

        atsResults.push(result);
        atsResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

        loader.innerHTML = `
            <div class="spinner"></div>
            <span>Screened ${atsResults.length} valid candidates...</span>
        `;

        renderATSLiveResults(container, atsResults, atsResults.length);

        return result;
    });

    atsResults = finalResults.filter(Boolean);
    atsResults.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

    allATSResults = atsResults;

    renderATSLiveResults(container, allATSResults, allATSResults.length);


        if (allATSResults.length > 0) {
            showWhatsAppButton("ats");
        }

        const atsDownloadBtn = document.getElementById("atsDownloadBtn");

        if (atsDownloadBtn && allATSResults.length > 0) {
            atsDownloadBtn.style.display = "inline-flex";
            atsDownloadBtn.innerHTML =
                `📥 Download Report (${allATSResults.length} Candidates)`;
        }

    } catch (err) {
        showModal('❌ Error', err.message);
    } finally {
        loader.style.display = 'none';
    }
}


// function renderCVCard(d, container, type = "manual") {
//     const score = d.overallScore || 0;
//     const phone = d.phone_number || d.phone || d.mobile || "";
//     let colorClass = score > 70 ? "score-green" : score >= 50 ? "score-yellow" : "score-red";

//     if (d.failed) {
//         container.insertAdjacentHTML('beforeend', `
//             <div class="cv-result-card" style="border-left: 5px solid #ef4444; opacity: 0.8;">
//                 <h3>❌ ${d.candidate_name}</h3>
//                 <p><strong>Status:</strong> ${d.rationale}</p>
//             </div>`);
//         return;
//     }

//     container.insertAdjacentHTML('beforeend', `
//         <div class="cv-result-card">
//             <div class="res-header">
//                 <div>
//                     <h3 style="margin:0;">${d.candidate_name}</h3>
//                     <small style="color:#64748b;">${phone || 'Phone not found'}</small><br>
//                     <small style="color:#64748b;">${d.recommendation}</small>
//                 </div>

//                 <div class="card-action-box">
//                     <button
//                         class="send-sms-btn"
//                         onclick="sendSMS('${phone}', '${d.candidate_name || "Candidate"}', '${score}', '${type}')"
//                     >
//                         Send SMS
//                     </button>

//                     <span class="score ${colorClass}">${score}%</span>
//                 </div>
//             </div>

//             <p style="margin-top:15px;"><strong>Rationale:</strong> ${d.rationale}</p>

//             <div class="sg-grid-3">
//                 <div class="sg-box strengths"><strong>Strengths</strong><ul>
//                     ${listify(d.strengths?.NIRF_and_Pedigree)}
//                     ${listify(d.strengths?.Experience_Alignment)}
//                 </ul></div>

//                 <div class="sg-box proximity-box"><strong>Proximity</strong><ul>${listify(d.proximity_matches)}</ul></div>

//                 <div class="sg-box gaps"><strong>Gaps</strong><ul>
//                     ${listify(d.gaps?.Functional_Gaps)}
//                     ${listify(d.gaps?.Domain_Mismatch)}
//                 </ul></div>
//             </div>
//         </div>`);
// }


async function promisePool(items, limit, worker) {
    const results = [];
    let index = 0;

    async function runWorker() {
        while (index < items.length) {
            const currentIndex = index++;
            const item = items[currentIndex];

            try {
                results[currentIndex] = await worker(item, currentIndex);
            } catch (err) {
                results[currentIndex] = {
                    candidate_name: item.name || item.candidate_name || `Candidate_${currentIndex + 1}`,
                    overallScore: 0,
                    recommendation: "Failed",
                    rationale: err.message,
                    ratings: {
                        jd_match: 0,
                        skills: 0,
                        experience: 0,
                        projects: 0,
                        education: 0
                    },
                    strengths: {
                        NIRF_and_Pedigree: [],
                        Experience_Alignment: [],
                        Projects_and_Quantifiable_Impact: []
                    },
                    proximity_matches: [],
                    gaps: {
                        Functional_Gaps: [],
                        Domain_Mismatch: []
                    },
                    jd_enhancement: {
                        missing_in_jd: []
                    }
                };
            }
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        () => runWorker()
    );

    await Promise.all(workers);
    return results;
}

function renderCVCard(d, container, type) {
    console.log("TTTTTTTTT"+type);
    const resumeUrl=d.resume_url || d.resume || "";
    const score = Number(d.overallScore || 0);
    const phone = d.phone_number || d.phone || d.mobile || "";
    const fit = fitLabel(score);
    const ratings = d.ratings || getFallbackRatings(d);

    const strengths = [
        ...(d.strengths?.Experience_Alignment || []),
        ...(d.strengths?.Projects_and_Quantifiable_Impact || []),
        ...(d.strengths?.NIRF_and_Pedigree || [])
    ];

    const gaps = [
        ...(d.gaps?.Functional_Gaps || []),
        ...(d.gaps?.Domain_Mismatch || [])
    ];

    if (d.failed) {
        container.insertAdjacentHTML("beforeend", `
            <div class="cv-result-card compact-card" style="border-left:5px solid #ef4444;">
                <h3>❌ ${d.candidate_name || "Candidate"}</h3>
                <p>${d.rationale || "Processing failed"}</p>
            </div>
        `);
        return;
    }

    container.insertAdjacentHTML("beforeend", `
        <div class="cv-result-card compact-card">

            <div class="candidate-topline">
                <div>
                    <h3>${d.candidate_name || "Candidate"}</h3>
                    <small class="candidate-phone">${phone || "Phone not found"}</small>
                    <br>
                    <span class="fit-badge ${fit.cls}">
                        ${d.recommendation || fit.text}
                    </span>
                </div>


                <div class="card-right-actions">
                    ${resumeUrl ? `
                        <button class="view-resume-btn" onclick="window.open('${resumeUrl}', '_blank')">
                            View Resume
                        </button>
                    ` : `
                        <button class="view-resume-btn disabled" disabled>
                            
                        </button>
                    `}

                    <button
                        class="send-sms-card-btn"
                        onclick="sendSingleCandidateSMS(
                            '${d.candidate_name || "Candidate"}',
                            '${phone}',
                            '${score}',
                            '${type}'
                        )"
                    >
                        Send SMS
                    </button>
                    <div class="score-ring" style="--score:${score}">
                        <span>${score}</span>
                    </div>
                </div>
            </div>

            <div class="rating-grid">

                <div class="rating-box">
                    <label>JD Match</label>
                    <strong>${ratingStars(ratings.jd_match)}</strong>
                </div>

                <div class="rating-box">
                    <label>Skills</label>
                    <strong>${ratingStars(ratings.skills)}</strong>
                </div>

                <div class="rating-box">
                    <label>Experience</label>
                    <strong>${ratingStars(ratings.experience)}</strong>
                </div>

                <div class="rating-box">
                    <label>Projects</label>
                    <strong>${ratingStars(ratings.projects)}</strong>
                </div>

                <div class="rating-box">
                    <label>Education</label>
                    <strong>${ratingStars(ratings.education)}</strong>
                </div>

            </div>

            <div class="easy-summary">
                ${d.rationale || "Summary not available."}
            </div>

            <div class="quick-evidence">

                <div class="evidence-box">
                    <b>✅ Best Evidence</b>
                    <div class="pill-wrap">
                        ${topItems(strengths, 2)}
                    </div>
                </div>

                <div class="evidence-box">
                    <b>⚠️ Key Gaps</b>
                    <div class="pill-wrap">
                        ${topItems(gaps, 2)}
                    </div>
                </div>

            </div>

        </div>
    `);
}




// function renderCVCard(d, container, type = "manual") {
//     const score = Number(d.overallScore || 0);
//     const phone = d.phone_number || d.phone || d.mobile || "";

//     const fit =
//         score >= 75 ? { text: "Strong Fit", cls: "fit-strong" } :
//         score >= 60 ? { text: "Good Fit", cls: "fit-good" } :
//         score >= 45 ? { text: "Average Fit", cls: "fit-mid" } :
//         { text: "Low Fit", cls: "fit-low" };

//     const strengths = [
//         ...(d.strengths?.Experience_Alignment || []),
//         ...(d.strengths?.Projects_and_Quantifiable_Impact || []),
//         ...(d.strengths?.NIRF_and_Pedigree || [])
//     ];

//     const gaps = [
//         ...(d.gaps?.Functional_Gaps || []),
//         ...(d.gaps?.Domain_Mismatch || [])
//     ];

//     const ratings = getFallbackRatings(d);

//     container.insertAdjacentHTML("beforeend", `
//         <div class="cv-result-card premium-card">

//             <div class="premium-card-header">
//                 <div>
//                     <h3>${d.candidate_name || "Candidate"}</h3>
//                     <small>${phone || "Phone not found"}</small>
//                     <br>
//                     <span class="fit-badge ${fit.cls}">${d.recommendation || fit.text}</span>
//                 </div>

//                 <div class="score-circle">
//                     <span>${score}</span>
//                     <small>/100</small>
//                 </div>
//             </div>

//             <div class="rating-grid">
//                 ${ratingBox("JD Match", ratings.jd_match)}
//                 ${ratingBox("Skills", ratings.skills)}
//                 ${ratingBox("Experience", ratings.experience)}
//                 ${ratingBox("Projects", ratings.projects)}
//                 ${ratingBox("Education", ratings.education)}
//             </div>

//             <div class="summary-strip">
//                 ${d.rationale || "Summary not available."}
//             </div>

//             <div class="evidence-grid">
//                 <div class="evidence-box">
//                     <h4>✅ Best Evidence</h4>
//                     <div class="pill-wrap">
//                         ${topItems(strengths, 2)}
//                     </div>
//                 </div>

//                 <div class="evidence-box">
//                     <h4>⚠️ Key Gaps</h4>
//                     <div class="pill-wrap">
//                         ${topItems(gaps, 2)}
//                     </div>
//                 </div>
//             </div>

//         </div>
//     `);
// }


// function renderCVCard(d, container, type = "manual") {
//     const score = Number(d.overallScore || 0);
//     const phone = d.phone_number || d.phone || d.mobile || "";

//     const fit =
//         score >= 75 ? { text: "Strong Fit", cls: "fit-strong" } :
//         score >= 60 ? { text: "Good Fit", cls: "fit-good" } :
//         score >= 45 ? { text: "Average Fit", cls: "fit-mid" } :
//         { text: "Low Fit", cls: "fit-low" };

//     if (d.failed) {
//         container.insertAdjacentHTML("beforeend", `
//             <div class="cv-result-card compact-card" style="border-left:5px solid #ef4444;">
//                 <h3>❌ ${d.candidate_name}</h3>
//                 <p>${d.rationale || "Processing failed"}</p>
//             </div>
//         `);
//         return;
//     }

//     const ratings = getFallbackRatings(d);

//     const strengths = [
//         ...(d.strengths?.Experience_Alignment || []),
//         ...(d.strengths?.Projects_and_Quantifiable_Impact || []),
//         ...(d.strengths?.NIRF_and_Pedigree || [])
//     ];

//     const gaps = [
//         ...(d.gaps?.Functional_Gaps || []),
//         ...(d.gaps?.Domain_Mismatch || [])
//     ];

//     container.insertAdjacentHTML("beforeend", `
//         <div class="cv-result-card compact-card">

//             <div class="candidate-topline">
//                 <div>
//                     <h3>${d.candidate_name || "Candidate"}</h3>
//                     <small style="color:#64748b;">${phone || "Phone not found"}</small><br>
//                     <span class="fit-badge ${fit.cls}">
//                         ${d.recommendation || fit.text}
//                     </span>
//                 </div>

//                 <div class="score-ring" style="--score:${score}">
//                     <span>${score}</span>
//                     <small>/100</small>
//                 </div>
//             </div>

//             <div class="rating-grid">
//                 <div>
//                     <label>JD Match</label>
//                     <strong>${ratingStars(ratings.jd_match)}</strong>
//                 </div>
//                 <div>
//                     <label>Skills</label>
//                     <strong>${ratingStars(ratings.skills)}</strong>
//                 </div>
//                 <div>
//                     <label>Experience</label>
//                     <strong>${ratingStars(ratings.experience)}</strong>
//                 </div>
//                 <div>
//                     <label>Projects</label>
//                     <strong>${ratingStars(ratings.projects)}</strong>
//                 </div>
//                 <div>
//                     <label>Education</label>
//                     <strong>${ratingStars(ratings.education)}</strong>
//                 </div>
//             </div>

//             <p class="easy-summary">
//                 ${d.rationale || "Summary not available."}
//             </p>

//             <div class="quick-evidence">
//                 <div>
//                     <b>✅ Best Evidence</b>
//                     <p>${topItems(strengths, 2)}</p>
//                 </div>

//                 <div>
//                     <b>⚠️ Key Gaps</b>
//                     <p>${topItems(gaps, 2)}</p>
//                 </div>
//             </div>

//         </div>
//     `);
// }


// function renderCVSummary(results, container) {
//     const total = results.length;
//     const strong = results.filter(r => (r.overallScore || 0) >= 75).length;
//     const good = results.filter(r => (r.overallScore || 0) >= 60 && (r.overallScore || 0) < 75).length;
//     const low = results.filter(r => (r.overallScore || 0) < 45).length;

//     container.insertAdjacentHTML('beforeend', `
//         <div class="cv-summary-strip">
//             <div><b>${total}</b><span>Total</span></div>
//             <div><b>${strong}</b><span>Strong Fit</span></div>
//             <div><b>${good}</b><span>Good Fit</span></div>
//             <div><b>${low}</b><span>Low Fit</span></div>
//         </div>
//     `);
// }

function renderCVSummary(results, container) {

    const total = results.length;

    const strong = results.filter(
        r => (r.overallScore || 0) >= 75
    ).length;

    const good = results.filter(
        r => (r.overallScore || 0) >= 60 &&
             (r.overallScore || 0) < 75
    ).length;

    const low = results.filter(
        r => (r.overallScore || 0) < 45
    ).length;

    container.insertAdjacentHTML('beforeend', `
        <div class="stats-grid">

            <div class="stats-card">
                <h2>${total}</h2>
                <p>Total</p>
            </div>

            <div class="stats-card">
                <h2>${strong}</h2>
                <p>Strong Fit</p>
            </div>

            <div class="stats-card">
                <h2>${good}</h2>
                <p>Good Fit</p>
            </div>

            <div class="stats-card">
                <h2>${low}</h2>
                <p>Low Fit</p>
            </div>

        </div>
    `);
}


// In cv-parser.js — replace the entire downloadCVReport function
async function downloadCVReport() {
    const btn = document.getElementById('cvDownloadBtn');
    btn.innerText = "⌛ Generating Report...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/cv/download-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: allCVResults })
        });

        if (!res.ok) {
            const err = await res.json();
            alert("Failed: " + err.error);
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Candidate_Audit_Report_' + new Date().toISOString().slice(0, 10) + '.docx';
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("Download Error: " + err.message);
    } finally {
        btn.innerText = '📥 Download Audit Report (' + allCVResults.length + ' Candidates)';
        btn.disabled = false;
    }
}