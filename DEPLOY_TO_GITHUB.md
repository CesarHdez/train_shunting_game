# Guía de Despliegue en GitHub Pages

**GitHub Pages** es una excelente opción para este proyecto: es **gratuito**, rápido y se integra directamente con tu código. Ideal para juegos estáticos como este.

### Prerrequisitos
1.  Tener una cuenta en [GitHub](https://github.com/).
2.  Tener instalado `git` en tu computadora.

### Pasos

#### 1. Crear el Repositorio en GitHub
1.  Ve a [github.com/new](https://github.com/new).
2.  Nombre del repositorio: `train-shunting-game` (o el que prefieras).
3.  Asegúrate de que sea **Público** (para usar Pages gratis).
4.  No marques "Initialize with README" (ya tienes archivos locales).
5.  Haz clic en **Create repository**.

#### 2. Subir tu código a GitHub
Abre una terminal en la carpeta de tu proyecto (`c:\Users\Personal\Documents\Proyectos\Train_Shuting`) y ejecuta:

```bash
# Inicializar git si no lo has hecho
git init

# Agregar todos los archivos
git add .

# Crear el primer commit
git commit -m "Versión inicial del juego"

# Renombrar la rama a main (estándar actual)
git branch -M main

# Conectar con tu repositorio remoto (reemplaza TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/train-shunting-game.git

# Subir los cambios
git push -u origin main
```

#### 3. Configurar GitHub Pages
1.  Ve a la página de tu repositorio en GitHub.
2.  Haz clic en la pestaña **Settings** (Configuración).
3.  En el menú de la izquierda, busca y haz clic en **Pages**.
4.  En la sección **Build and deployment**:
    *   **Source**: Déjalo en `Deploy from a branch`.
    *   **Branch**: Selecciona `main` y la carpeta `/web` (IMPORTANTE: selecciona `/web` en lugar de `/root` porque ahí está tu `index.html`).
    *   Haz clic en **Save**.

#### 4. ¡Listo!
GitHub tardará unos minutos (1-2 min) en construir el sitio.
Refresca la página de Settings > Pages y verás un mensaje:

> **Your site is live at...**
> `https://TU_USUARIO.github.io/train-shunting-game/`

¡Ese es el enlace para compartir tu juego!

---

### Nota sobre Actualizaciones
Cada vez que hagas cambios en tu código, solo necesitas hacer:
```bash
git add .
git commit -m "Descripción de los cambios"
git push
```
GitHub Pages detectará los cambios en la carpeta `/web` y actualizará el sitio automáticamente en unos minutos.
