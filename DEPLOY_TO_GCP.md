# Guía de Despliegue en Google Cloud Platform (GCP)

Esta guía te explicará paso a paso cómo desplegar la versión web de **Train Shunting** en GCP.

Tienes dos opciones principales:
1.  **Firebase Hosting** (Recomendado): Más fácil, gratuito para proyectos pequeños, incluye SSL (HTTPS) automático.
2.  **Google Cloud Storage (GCS)**: Hospedaje estático en un "bucket".

---

## Opción 1: Firebase Hosting (Recomendado)

Firebase es parte de Google Cloud y es la forma más sencilla de alojar juegos web estáticos.

### Prerrequisitos
1.  Tener instalada la línea de comandos de Firebase. Si tienes Node.js instalado, ejecuta:
    ```bash
    npm install -g firebase-tools
    ```

### Pasos
1.  **Inicia sesión en Google:**
    ```bash
    firebase login
    ```
    Se abrirá una ventana en tu navegador para autorizar.

2.  **Inicializa el proyecto:**
    Abre una terminal en la carpeta raíz del proyecto (`c:\Users\Personal\Documents\Proyectos\Train_Shuting`) y ejecuta:
    ```bash
    firebase init
    ```
    *   **Are you ready to proceed?**: `Yes`
    *   **Which Firebase features do you want to set up?**: Selecciona `Hosting: Configure files for Firebase Hosting and (optionally) set up GitHub Action deploys` (usa la barra espaciadora para marcar y Enter para confirmar).
    *   **Please select an option**: `Create a new project` (o usa uno existente si ya tienes).
        *   Asigna un **Project ID** único (ej: `train-shunting-game-2025`).
        *   Asigna un nombre (ej: `Train Shunting`).
    *   **What do you want to use as your public directory?**: Escribe `web` (esto es importante, ya que ahí están tus archivos `index.html`, `game.js`, etc.).
    *   **Configure as a single-page app (rewrite all urls to /index.html)?**: `No` (importante para que carguen los JSON de niveles correctamente).
    *   **Set up automatic builds and deploys with GitHub?**: `No` (por ahora).
    *   **File web/index.html already exists. Overwrite?**: `No`.

3.  **Desplegar:**
    Una vez configurado, simplemente ejecuta:
    ```bash
    firebase deploy
    ```

    ¡Listo! La terminal te dará una **Hosting URL** (ej: `https://train-shunting-game-2025.web.app`) donde tu juego ya está online.

---

## Opción 2: Google Cloud Storage (Bucket Estático)

Si prefieres usar un Bucket de almacenamiento estándar de GCP.

### Prerrequisitos
1.  Tener instalado el **Google Cloud SDK** (comando `gcloud` y `gsutil`).
2.  Tener un proyecto de GCP creado y facturación habilitada (aunque el costo sea mínimo/nulo).

### Pasos
1.  **Inicia sesión:**
    ```bash
    gcloud auth login
    ```

2.  **Configura tu proyecto:**
    ```bash
    gcloud config set project [TU_ID_DE_PROYECTO]
    ```

3.  **Crea un Bucket:**
    El nombre del bucket debe ser único globalmente.
    ```bash
    gsutil mb gs://train-shunting-game-bucket
    ```

4.  **Haz el Bucket público:**
    Esto permite que cualquiera en internet vea los archivos.
    ```bash
    gsutil iam ch allUsers:objectViewer gs://train-shunting-game-bucket
    ```

5.  **Configura el Bucket como sitio web:**
    Indica cuál es la página principal y la de error.
    ```bash
    gsutil web set -m index.html -e 404.html gs://train-shunting-game-bucket
    ```

6.  **Sube los archivos:**
    Copia todo el contenido de la carpeta `web` al bucket.
    ```bash
    gsutil -m rsync -r web gs://train-shunting-game-bucket
    ```

7.  **Acceder:**
    Tu juego estará disponible en: `https://storage.googleapis.com/train-shunting-game-bucket/index.html`
    *(Nota: GCS por defecto usa una URL larga. Para usar un dominio propio con SSL en GCS necesitas configurar un Load Balancer, lo cual es más complejo y costoso. Por eso se recomienda Firebase).*
