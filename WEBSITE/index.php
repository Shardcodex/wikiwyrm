<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>WikiWyrm - The Worldbuilder's Wiki</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      plugins: [daisyui],
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/daisyui@3.7.4/dist/full.js"></script>
<link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet" type="text/css" />
</head>
<body class="flex flex-col min-h-screen">

  <!-- Navbar -->
  <div class="navbar bg-base-100 shadow">
    <div class="flex-1">
      <a class="btn btn-ghost normal-case text-2xl text-primary">WikiWyrm</a>
    </div>
    <div class="flex-none">
      <a href="#waitlist" class="btn btn-outline btn-primary">Join Waitlist</a>
    </div>
  </div>

  <!-- Hero -->
  <section class="flex flex-col items-center text-center px-6 py-24 max-w-3xl mx-auto">
    <h1 class="text-4xl md:text-6xl font-bold mb-6 leading-tight">
      Build Worlds, Craft Lore, and <span class="text-primary">Write Your Legends</span>
    </h1>
    <p class="text-lg md:text-xl mb-8 text-base-content/70">
      WikiWyrm is a private wiki platform crafted for authors, storytellers, and creative minds who breathe life into new worlds.
    </p>
    <a href="#waitlist" class="btn btn-primary btn-lg">Request an Invite</a>
  </section>

  <!-- Features -->
  <section class="grid md:grid-cols-3 gap-8 px-8 py-16 max-w-6xl mx-auto">
    <div class="card bg-base-100 shadow-xl border">
      <div class="card-body">
        <h3 class="card-title text-primary">Tailored for Writers</h3>
        <p>
          Structure your characters, settings, magic systems, plots, and histories — all in one place.
        </p>
      </div>
    </div>
    <div class="card bg-base-100 shadow-xl border">
      <div class="card-body">
        <h3 class="card-title text-primary">Flexible & Private</h3>
        <p>
          Keep your notes private or share them selectively. Your world, your rules.
        </p>
      </div>
    </div>
    <div class="card bg-base-100 shadow-xl border">
      <div class="card-body">
        <h3 class="card-title text-primary">Built for Worldbuilding</h3>
        <p>
          Timeline tools, infoboxes, and lore relationships — designed for creators who think beyond pages.
        </p>
      </div>
    </div>
  </section>

  <!-- Invite Only -->
  <section id="waitlist" class="flex flex-col items-center text-center px-6 py-24 max-w-xl mx-auto">
    <h2 class="text-3xl md:text-4xl font-bold mb-4">Currently Invite Only</h2>
    <p class="text-base-content/70 mb-8">
      We're rolling out slowly to ensure the best experience. Sign up below to join our waiting list.
    </p>
    <form class="flex w-full max-w-md">
      <input type="email" placeholder="you@example.com" class="input input-bordered w-full rounded-r-none" />
      <button type="submit" class="btn btn-primary rounded-l-none">Join</button>
    </form>
  </section>

  <!-- Footer -->
  <footer class="footer footer-center p-8 bg-base-200 text-base-content">
    <div>
      &copy; 2025 WikiWyrm. Crafted for dreamers & creators.
    </div>
  </footer>

</body>
</html>
