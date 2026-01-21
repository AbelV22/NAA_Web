/**
 * PasswordGate.js
 * Simple client-side password protection with dual user roles.
 * - Basic users (itm22View): Can only select isotopes
 * - Admin users (itm22Fisica): Full access to all parameters
 */
import { UserRoles } from '../store/UserRoles.js';

export class PasswordGate {
    static async init() {
        const SESSION_KEY = 'naa_auth_session';
        const ROLE_KEY = 'naa_user_role';

        // Password configuration
        const PASSWORDS = {
            'itm22Fisica': 'admin',  // Full access
            'itm22View': 'basic'     // View/select isotopes only
        };

        console.log('PasswordGate: Starting initialization');

        // Check existing session
        try {
            const existingRole = sessionStorage.getItem(ROLE_KEY);
            if (existingRole && sessionStorage.getItem(SESSION_KEY) === 'true') {
                console.log(`PasswordGate: Session valid (role: ${existingRole})`);
                return { authenticated: true, role: existingRole };
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
                const enteredPass = input.value;
                const role = PASSWORDS[enteredPass];

                if (role) {
                    // Valid password - store session and role
                    try {
                        sessionStorage.setItem(SESSION_KEY, 'true');
                        sessionStorage.setItem(ROLE_KEY, role);
                        UserRoles.setRole(role);
                    } catch (e) {
                        console.warn('PasswordGate: Could not persist session');
                    }

                    modal.remove();
                    resolve({ authenticated: true, role: role });
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
