import AuthService from "../../services/api/auth.js";
import { createIcons, icons } from "../../../node_modules/lucide/dist/esm/lucide.mjs";

export function mount() {
    // تفعيل أيقونات الـ lucide مثل الـ truck
    createIcons({ icons });

    const form = document.getElementById("login-form");
    const errorEl = document.getElementById("login-error");
    const loginBtn = document.getElementById("login-btn");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // إخفاء الأخطاء وتفعيل حالة التحميل
        errorEl.style.display = "none";
        const originalBtnText = loginBtn.innerHTML;
        loginBtn.disabled = true;
        loginBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Signing in...`;
        createIcons({ icons });

        const res = await AuthService.login(
            document.getElementById("email").value,
            document.getElementById("password").value
        );

        if (res.success) {
            // توجيه للوحة التحكم عند النجاح
            window.location.href = "/";
        } else {
            // إعادة الزر لحالته وإظهار رسالة الخطأ
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnText;
            errorEl.textContent = res.message;
            errorEl.style.display = "flex";
        }
    });
}