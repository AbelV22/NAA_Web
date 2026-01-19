/**
 * PasswordGate.js
 * Simple client-side password protection.
 */
export class PasswordGate {
    static async init() {
        const SESSION_KEY = 'naa_auth_session';
        const REQUIRED_PASS = 'itm22Fisica';

        console.log('PasswordGate: Starting initialization');

        try {
            if (sessionStorage.getItem(SESSION_KEY) === 'true') {
                console.log('PasswordGate: Session valid');
                return true;
            }
        } catch (e) {
            console.warn('PasswordGate: SessionStorage inaccessible', e);
        }

        return new Promise((resolve) => {
            // Create Modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(10, 10, 25, 0.95); z-index: 99999;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                backdrop-filter: blur(10px);
            `;

            modal.innerHTML = `
                <div class="card" style="padding: 2rem; width: 300px; text-align: center; border: 1px solid var(--primary-color);">
                    <div style="margin-bottom: 1.5rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <h2 style="margin-top: 0; margin-bottom: 1rem;">Restricted Access</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
                        This tool handles sensitive nuclear data. Please authenticate.
                    </p>
                    <input type="password" id="gate-pass" placeholder="Enter Password" 
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #444; background: #222; color: white; margin-bottom: 1rem;">
                    <button id="gate-btn" class="btn-primary" style="width: 100%;">Unlock Tool</button>
                    <p id="gate-error" style="color: #ff6b6b; font-size: 0.8rem; margin-top: 1rem; min-height: 1.2em;"></p>
                </div>
            `;

            document.body.appendChild(modal);

            const input = modal.querySelector('#gate-pass');
            const btn = modal.querySelector('#gate-btn');
            const errorMsg = modal.querySelector('#gate-error');

            const checkPass = () => {
                if (input.value === REQUIRED_PASS) {
                    sessionStorage.setItem(SESSION_KEY, 'true');
                    modal.remove();
                    resolve(true);
                } else {
                    errorMsg.textContent = 'Incorrect password';
                    input.value = '';
                    input.focus();
                }
            };

            btn.addEventListener('click', checkPass);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') checkPass();
            });

            // Focus input
            setTimeout(() => input.focus(), 100);
        });
    }
}
