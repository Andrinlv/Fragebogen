document.addEventListener('DOMContentLoaded', () => {
    
    // --- KONFIGURATION ---
    // HIER DEINE GOOGLE APPS SCRIPT URL EINFÜGEN:
    const scriptURL = 'https://script.google.com/macros/s/AKfycbxrCNjeTy5K_9N1jcZCYXMH6ONtITx25FWrjRf5cHFj2aJRjJ7kByR8uFwPQQiHWQlz/exec'; 
    
    // --- 1. Zeichenzähler Logik ---
    const counters = document.querySelectorAll('.counter');
    counters.forEach(counter => {
        const inputId = counter.getAttribute('data-for');
        const inputElement = document.getElementById(inputId);
        
        if(inputElement) {
            inputElement.addEventListener('input', () => {
                const currentLength = inputElement.value.length;
                const maxLength = inputElement.getAttribute('maxlength');
                counter.textContent = `${currentLength} / ${maxLength}`;
            });
        }
    });

    // --- 2. Formular Handling ---
    const form = document.getElementById('feedbackForm');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusBox = document.getElementById('statusMessage');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Variable um die Daten für den PDF Download zu halten
    let lastSubmissionData = null;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Button Loading State
        const originalBtnText = submitBtn.querySelector('span').innerText;
        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = "Sende...";

        // Daten sammeln
        const formData = new FormData(form);
        const timestamp = new Date().toLocaleString('de-CH');
        
        // Checkboxen (Lehre) manuell zusammenfügen, da Google Sheets sonst nur den letzten Wert nimmt
        const lehreAuswahl = formData.getAll('lehre').join(', ');

        // Objekt für den Versand erstellen
        const requestBody = new FormData();
        requestBody.append('gesamt', formData.get('gesamtbewertung') || '-');
        requestBody.append('workshops', formData.get('workshops') || '-');
        requestBody.append('lehre', lehreAuswahl || 'Keine Angabe');
        requestBody.append('highlight', formData.get('highlight') || '-');
        requestBody.append('verbesserung', formData.get('verbesserung') || '-');

        // Objekt für PDF Generierung speichern
        lastSubmissionData = {
            datum: timestamp,
            gesamt: formData.get('gesamtbewertung'),
            workshops: formData.get('workshops'),
            lehre: lehreAuswahl,
            highlight: formData.get('highlight'),
            verbesserung: formData.get('verbesserung')
        };

        // An Google Sheets senden
        fetch(scriptURL, { method: 'POST', body: requestBody })
            .then(response => {
                // UI Feedback Erfolg
                statusBox.classList.remove('hidden');
                statusBox.scrollIntoView({ behavior: 'smooth', block: 'end' });
                
                // Formular resetten
                form.reset();
                
                // PDF Download vorbereiten
                enablePdfDownload();

                // Button zurücksetzen
                submitBtn.querySelector('span').innerText = "Gesendet!";
                // Optional: Nach 3 Sekunden Button wieder aktivieren (falls man noch eins senden will)
                setTimeout(() => {
                   submitBtn.disabled = false;
                   submitBtn.querySelector('span').innerText = originalBtnText;
                }, 3000);
            })
            .catch(error => {
                console.error('Fehler!', error.message);
                alert("Es gab einen Fehler beim Senden. Bitte überprüfe deine Internetverbindung.");
                submitBtn.disabled = false;
                submitBtn.querySelector('span').innerText = originalBtnText;
            });
    });

    // --- 3. PDF Generierung ---
    function enablePdfDownload() {
        downloadBtn.disabled = false;
        
        // Button Text anpassen
        const span = downloadBtn.querySelector('span');
        span.innerText = "PDF speichern 📥";

        // Event Listener bereinigen (Clone Trick), damit wir nicht mehrere Clicks stapeln
        const newBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
        
        newBtn.addEventListener('click', () => {
            generatePDF(lastSubmissionData);
        });
    }

    function generatePDF(data) {
        if (!data) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Design-Einstellungen
        const primaryColor = [225, 6, 0]; // Bell Rot
        const textColor = [45, 45, 45];
        
        // Header
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 20, 'F'); // Roter Balken oben
        
        doc.setFontSize(22);
        doc.setTextColor(...primaryColor);
        doc.text("IT-Schnuppermorgen Feedback", 20, 40);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Erstellt am: ${data.datum}`, 20, 48);
        
        // Linie
        doc.setDrawColor(200);
        doc.line(20, 55, 190, 55);

        // Inhalt
        let yPos = 70;
        const lineHeight = 10;
        const pageHeight = 280; // A4 Höhe Reserve

        // Helper Funktion für Abschnitte
        function addSection(title, content) {
            // Seitenumbruch check
            if (yPos > 250) {
                doc.addPage();
                yPos = 30;
            }

            doc.setFontSize(12);
            doc.setTextColor(...primaryColor);
            doc.setFont("helvetica", "bold");
            doc.text(title, 20, yPos);
            yPos += 7;

            doc.setFontSize(11);
            doc.setTextColor(...textColor);
            doc.setFont("helvetica", "normal");
            
            // Textumbruch für lange Texte (Highlight/Verbesserung)
            const splitText = doc.splitTextToSize(content || "-", 170);
            doc.text(splitText, 20, yPos);
            
            yPos += (splitText.length * 6) + 10; // Abstand zum nächsten Block
        }

        addSection("1. Gesamtbewertung", data.gesamt);
        addSection("2. Workshops Bewertung", data.workshops);
        addSection("3. Interessante Lehrberufe", data.lehre || "Keine Auswahl");
        addSection("4. Was hat dir am meisten gefallen?", data.highlight);
        addSection("5. Was können wir besser machen?", data.verbesserung);

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("Bell Schweiz AG - IT Abteilung", 105, 290, null, null, "center");

        // Speichern
        doc.save(`Feedback_Bell_IT_${Date.now()}.pdf`);
    }

    // Initiale Animation
    document.body.style.opacity = 1;
});