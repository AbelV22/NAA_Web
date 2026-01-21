/**
 * UserRoles.js
 * Role-based access control for the NAA Web Calculator.
 * Manages user permissions based on login role (basic vs admin).
 */

const SESSION_ROLE_KEY = 'naa_user_role';

// Fields that are always editable by any user (isotope selection inputs)
const ALWAYS_EDITABLE = [
    'input-iso',      // Single isotope input
    'imp-sym',        // Impurity element symbol input
    'waste-imp-sym',  // Waste impurity symbol input
    'lim-sym'         // Limit element symbol input
];

// Fields that require admin access
const ADMIN_ONLY_FIELDS = [
    // Single Isotope Tab
    'input-mass',
    'input-flux',
    'input-time',
    'input-cool',

    // Impurity Tab
    'imp-ppm',
    'imp-mass',
    'imp-flux',
    'imp-time',
    'imp-cool',

    // Waste Tab
    'waste-imp-ppm',
    'waste-mass',
    'waste-total',
    'waste-flux',
    'waste-time',
    'waste-cool',

    // Limit Tab
    'lim-frac',
    'lim-waste',
    'lim-mass',
    'lim-wmass',
    'lim-flux',
    'lim-time',
    'lim-cool',
    'lim-type'
];

// Buttons that require admin access
const ADMIN_ONLY_BUTTONS = [
    'btn-add-imp',
    'btn-add-waste-imp',
    'btn-add-lim'
];

// Button classes that require admin access
const ADMIN_ONLY_BUTTON_CLASSES = [
    'btn-save-preset',
    'btn-load-preset',
    'btn-remove-item'
];

export class UserRoles {
    /**
     * Get the current user role from session storage.
     * @returns {'admin' | 'basic' | null} The user role or null if not logged in.
     */
    static getCurrentRole() {
        try {
            return sessionStorage.getItem(SESSION_ROLE_KEY);
        } catch (e) {
            console.warn('UserRoles: Cannot access sessionStorage');
            return null;
        }
    }

    /**
     * Set the user role in session storage.
     * @param {'admin' | 'basic'} role The role to set.
     */
    static setRole(role) {
        try {
            sessionStorage.setItem(SESSION_ROLE_KEY, role);
        } catch (e) {
            console.warn('UserRoles: Cannot write to sessionStorage');
        }
    }

    /**
     * Check if current user is admin.
     * @returns {boolean}
     */
    static isAdmin() {
        return this.getCurrentRole() === 'admin';
    }

    /**
     * Check if current user is basic.
     * @returns {boolean}
     */
    static isBasic() {
        return this.getCurrentRole() === 'basic';
    }

    /**
     * Check if the user can edit a specific field.
     * @param {string} fieldId The ID of the field to check.
     * @returns {boolean}
     */
    static canEditField(fieldId) {
        // Admin can edit everything
        if (this.isAdmin()) return true;

        // Always editable fields (isotope inputs)
        if (ALWAYS_EDITABLE.includes(fieldId)) return true;

        // If basic user and field is admin-only, deny
        if (ADMIN_ONLY_FIELDS.includes(fieldId)) return false;

        // Default to allowing for any unknown fields
        return true;
    }

    /**
     * Check if user can use a specific button.
     * @param {string} buttonId The ID of the button.
     * @param {string[]} buttonClasses The class list of the button.
     * @returns {boolean}
     */
    static canUseButton(buttonId, buttonClasses = []) {
        // Admin can use everything
        if (this.isAdmin()) return true;

        // Check by ID
        if (ADMIN_ONLY_BUTTONS.includes(buttonId)) return false;

        // Check by class
        for (const cls of buttonClasses) {
            if (ADMIN_ONLY_BUTTON_CLASSES.includes(cls)) return false;
        }

        return true;
    }

    /**
     * Apply restrictions to all form fields based on current role.
     * This should be called after forms are rendered.
     */
    static applyRestrictions() {
        const role = this.getCurrentRole();
        console.log(`UserRoles: Applying restrictions for role "${role}"`);

        if (role === 'admin') {
            // Admin: Remove all restrictions
            this._enableAllFields();
            return;
        }

        // Basic user: Apply restrictions
        this._applyBasicRestrictions();
    }

    /**
     * Enable all fields (for admin users).
     */
    static _enableAllFields() {
        document.querySelectorAll('.input-restricted').forEach(el => {
            el.classList.remove('input-restricted');
            el.disabled = false;
        });
        document.querySelectorAll('.btn-restricted').forEach(el => {
            el.classList.remove('btn-restricted');
            el.disabled = false;
            el.style.display = '';
        });
    }

    /**
     * Apply restrictions for basic users.
     */
    static _applyBasicRestrictions() {
        // Restrict admin-only input fields
        ADMIN_ONLY_FIELDS.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.disabled = true;
                field.classList.add('input-restricted');
            }
        });

        // Restrict admin-only buttons by ID
        ADMIN_ONLY_BUTTONS.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = true;
                btn.classList.add('btn-restricted');
            }
        });

        // Restrict admin-only buttons by class
        ADMIN_ONLY_BUTTON_CLASSES.forEach(cls => {
            document.querySelectorAll(`.${cls}`).forEach(btn => {
                btn.disabled = true;
                btn.classList.add('btn-restricted');
            });
        });
    }

    /**
     * Get a display-friendly role name.
     * @returns {string}
     */
    static getRoleDisplayName() {
        const role = this.getCurrentRole();
        if (role === 'admin') return 'Administrator';
        if (role === 'basic') return 'Viewer';
        return 'Unknown';
    }
}
