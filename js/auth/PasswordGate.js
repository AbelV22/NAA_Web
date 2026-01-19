/**
 * Password Gate for Nuclear Calculator
 * Uses SHA-256 hashing for password obfuscation
 */

const PasswordGate = {
    // SHA-256 hashes of valid passwords (not the actual passwords!)
    // Use password_helper.html to generate new hashes
    validHashes: [
        '5bc997939c2cd911d2586194ef3c39561cae6b1feaee12c018769373ff5c8ba7', // Primary password
        'ca42ab62fb0648630652295abc093e9be251f139c0b3d19fa93803bfda697c33', // Alternative 1
        'c407f90d5044ce805a8efdbd1201c92bbce169b139b42c52665247cf9a01db2f'  // Alternative 2
    ],

    // Storage key
    storageKey: 'nuclear_calc_auth',

    // Session duration (7 days in milliseconds)
    sessionDuration: 7 * 24 * 60 * 60 * 1000,

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const session = localStorage.getItem(this.storageKey);
        if (!session) return false;

        try {
            const data = JSON.parse(session);
            const now = Date.now();
            return data.expires > now;
        } catch {
            return false;
        }
    },

    /**
     * SHA-256 hash function using Web Crypto API
     */
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    /**
     * Verify password against stored hashes
     */
    async verifyPassword(password) {
        const inputHash = await this.sha256(password);
        return this.validHashes.includes(inputHash);
    },

    /**
     * Authenticate and save session
     */
    async authenticate(password) {
        const isValid = await this.verifyPassword(password);
        if (isValid) {
            const session = {
                authenticated: true,
                expires: Date.now() + this.sessionDuration
            };
            localStorage.setItem(this.storageKey, JSON.stringify(session));
            return true;
        }
        return false;
    },

    /**
     * Logout
     */
    logout() {
        localStorage.removeItem(this.storageKey);
    },

    /**
     * Create and show login overlay
     */
    showLoginScreen(onSuccess) {
        const overlay = document.createElement('div');
        overlay.id = 'password-gate';
        overlay.innerHTML = `
            <div class="gate-container">
                <div class="gate-card">
                    <div class="gate-logo">
                        <img src="./public/assets/itm_logo_claim_white_rgb_high-res.png" alt="ITM" onerror="this.style.display='none'">
                    </div>
                    <h1 class="gate-title">Thermal NAA Tool</h1>
                    <p class="gate-subtitle">Powered by ITM Medical Isotopes GmbH</p>
                    
                    <form id="gate-form" class="gate-form">
                        <div class="gate-input-group">
                            <input type="password" id="gate-password" placeholder="Enter access code" autocomplete="current-password" required>
                        </div>
                        <button type="submit" class="gate-button">
                            <span>Access Calculator</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </button>
                        <p id="gate-error" class="gate-error"></p>
                    </form>
                    
                    <p class="gate-footer">ITM Medical Isotopes • Internal Use Only</p>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #password-gate {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a1a2a 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .gate-container {
                width: 100%;
                max-width: 420px;
                padding: 24px;
            }
            
            .gate-card {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 48px 40px;
                backdrop-filter: blur(20px);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            
            .gate-logo {
                text-align: center;
                margin-bottom: 32px;
            }
            
            .gate-logo img {
                height: 50px;
                opacity: 0.9;
            }
            
            .gate-title {
                color: white;
                font-size: 28px;
                font-weight: 700;
                text-align: center;
                margin: 0 0 8px 0;
                letter-spacing: -0.5px;
            }
            
            .gate-subtitle {
                color: rgba(255, 255, 255, 0.5);
                font-size: 14px;
                text-align: center;
                margin: 0 0 40px 0;
            }
            
            .gate-form {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .gate-input-group input {
                width: 100%;
                padding: 16px 20px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                color: white;
                font-size: 16px;
                transition: all 0.2s ease;
                box-sizing: border-box;
            }
            
            .gate-input-group input:focus {
                outline: none;
                border-color: #00d4ff;
                background: rgba(0, 212, 255, 0.05);
                box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
            }
            
            .gate-input-group input::placeholder {
                color: rgba(255, 255, 255, 0.4);
            }
            
            .gate-button {
                width: 100%;
                padding: 16px 24px;
                background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: all 0.2s ease;
            }
            
            .gate-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 30px -10px rgba(0, 212, 255, 0.5);
            }
            
            .gate-button:active {
                transform: translateY(0);
            }
            
            .gate-error {
                color: #ff6b6b;
                font-size: 14px;
                text-align: center;
                margin: 8px 0 0 0;
                min-height: 20px;
            }
            
            .gate-footer {
                color: rgba(255, 255, 255, 0.3);
                font-size: 12px;
                text-align: center;
                margin: 32px 0 0 0;
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-8px); }
                75% { transform: translateX(8px); }
            }
            
            .gate-shake {
                animation: shake 0.4s ease-in-out;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // Handle form submission
        const form = document.getElementById('gate-form');
        const passwordInput = document.getElementById('gate-password');
        const errorEl = document.getElementById('gate-error');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = passwordInput.value;

            const isValid = await this.authenticate(password);
            if (isValid) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    overlay.remove();
                    style.remove();
                }, 300);
                if (onSuccess) onSuccess(true);
            } else {
                errorEl.textContent = 'Invalid access code. Please try again.';
                passwordInput.classList.add('gate-shake');
                setTimeout(() => passwordInput.classList.remove('gate-shake'), 400);
                passwordInput.value = '';
                passwordInput.focus();
            }
        });

        passwordInput.focus();
    },

    /**
     * Initialize - check auth and show login if needed
     * Returns a Promise that resolves to true when authenticated
     */
    init() {
        return new Promise((resolve) => {
            if (this.isAuthenticated()) {
                resolve(true);
            } else {
                this.showLoginScreen(resolve);
            }
        });
    }
};

// Export for use in app.js
export { PasswordGate };
