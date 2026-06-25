(function () {
  // TODO(Task 7): replace with the deployed Cloudflare Worker URL.
  var WORKER_URL = "https://REPLACE-ME.workers.dev";
  // Shown to visitors if sending fails. Confirm this is a monitored inbox.
  var FALLBACK_EMAIL = "info@starrhillpresents.com";

  var form = document.getElementById("contact-form");
  if (!form) return;
  var statusEl = document.getElementById("cf-status");
  var submitBtn = document.getElementById("cf-submit");
  if (!statusEl || !submitBtn) return;

  function val(name) {
    var el = form.elements[name];
    return el ? String(el.value).trim() : "";
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "cf-status" + (kind ? " cf-status--" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.checkValidity()) {
      setStatus("Please fill in all required fields with a valid email.", "error");
      return;
    }

    var data = {
      name: val("name"),
      email: val("email"),
      phone: val("phone"),
      inquiryType: val("inquiryType"),
      message: val("message"),
      company: form.elements["company"] ? form.elements["company"].value : ""
    };

    var originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    setStatus("", "");

    fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Bad response " + res.status);
        setStatus("Thanks! We got your message and will be in touch.", "success");
        form.reset();
      })
      .catch(function () {
        setStatus(
          "Sorry — something went wrong. Please email us at " + FALLBACK_EMAIL + ".",
          "error"
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });
})();
