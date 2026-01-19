# Deploying the Thermal NAA Tool

Host the Thermal Neutron Activation & Analysis Tool (ITM Medical Isotopes GmbH) for free with password protection.

---

## 🚀 Step 1: Create a GitHub Repository

1. Log in to [GitHub.com](https://github.com).
2. Click the **+** icon (top right) → **New repository**.
3. Name it `nuclear-calculator` (or similar).
4. Select **Public** (required for free GitHub Pages).
5. Click **Create repository**.

---

## 📤 Step 2: Upload Your Code

You can do this via the website or using Git Desktop/Command Line.

### Option A: Web Upload (Easiest)
1. On your new repository page, click **uploading an existing file**.
2. Drag and drop **ALL files inside** the `premium_app` folder.
   - `index.html`
   - `css/` folder
   - `js/` folder
   - `public/` folder
3. Commit the changes.

### Option B: Command Line (Professional)
Run these commands inside your `premium_app` folder:

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nuclear-calculator.git
git push -u origin main
```

---

## ⚙️ Step 3: Enable GitHub Pages

1. Go to your repository **Settings** tab.
2. Click **Pages** in the left sidebar.
3. Under **Build and deployment** > **Branch**, select `main` (or `master`).
4. Click **Save**.

Wait about 1-2 minutes. GitHub will show you the live URL!

---

## 🔐 Password Protection

Your app is now protected!
- **Primary Password**: `itm22Fisica`
- **Alternative Passwords**: `NuclearITM2026`, `ITM2026`
- **To Change It**: Edit `js/auth/PasswordGate.js` and update the `verifyPassword` logic.

### ⚠️ Important Note
Since this is a client-side password, tech-savvy users could technically bypass it by inspecting the code. For internal tools this is usually acceptable, but do not put sensitive patient data in the app code itself.

---

## ✅ Verification Checklist

- [ ] Visit the GitHub Pages URL
- [ ] Verify the "Thermal NAA Tool" title appears on the login screen
- [ ] Enter `NuclearITM2026`
- [ ] Verify the Calculator loads correctly
