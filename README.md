# Task Manager Web App

A containerized task management application built to practice **Docker, Docker Compose, container networking, and multi-container application deployment**.

The application uses a frontend, a Node.js API, and a PostgreSQL database, with Docker Compose managing the services.

## 🚀 Features

* Create and manage tasks.
* View tasks in a clean web interface.
* Mark tasks as completed or incomplete.
* Delete tasks.
* Store task data in PostgreSQL.
* Run the entire application using Docker Compose.
* Persist database data using a Docker named volume.

## 🛠️ Tech Stack

| Technology            | Purpose                       |
| --------------------- | ----------------------------- |
| HTML, CSS, JavaScript | Frontend                      |
| Node.js & Express     | Backend REST API              |
| PostgreSQL 17         | Database                      |
| Nginx                 | Frontend web server           |
| Docker                | Containerization              |
| Docker Compose        | Multi-container orchestration |

## 🏗️ Architecture

The application consists of three services:

* **Frontend:** Serves the web interface through Nginx.
* **Backend API:** Handles task operations and communicates with the database.
* **Database:** Stores task records in PostgreSQL.

```text
             User / Browser
                    |
                    v
              Frontend
             Nginx :80
                    |
                    v
             Backend API
             Node.js :5000
                    |
                    v
               PostgreSQL
                DB :5432
```

Docker Compose creates and manages the services and their networking.

## 📂 Project Structure

```text
task-manager-web-app/
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
│
├── db/
│   ├── Dockerfile
│   └── init.sql
│
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── script.js
│   └── style.css
│
├── docker-compose.yml
└── README.md
```

## ⚙️ Prerequisites

Before running the application, make sure you have:

* [Docker](https://www.docker.com/) installed.
* Docker Compose available through the Docker CLI.

## ▶️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mahmoudnassaredu/task-manager-web-app.git
```

### 2. Navigate to the project directory

```bash
cd task-manager-web-app
```

### 3. Build and start the application

```bash
docker compose up --build -d
```

This command builds the images and starts the application services in the background.

### 4. Access the application

Open your browser and visit:

**http://localhost:3001**

### 5. Check the running containers

```bash
docker compose ps
```

### 6. View application logs

```bash
docker compose logs -f
```

To view logs for a specific service:

```bash
docker compose logs -f frontend
docker compose logs -f api
docker compose logs -f db
```

### 7. Stop the application

```bash
docker compose down
```

The PostgreSQL data is stored in a named volume, so stopping the services this way does not normally delete the database volume.

To remove the containers and the database volume as well, run:

```bash
docker compose down -v
```

**Warning:** Removing the volume deletes the persisted database data.

## 🐳 Docker Concepts Demonstrated

This project provides hands-on experience with:

* Writing Dockerfiles for different services.
* Building custom Docker images.
* Running multiple containers with Docker Compose.
* Connecting services through Docker networking.
* Configuring environment variables.
* Managing service dependencies and database health checks.
* Persisting database data using Docker volumes.
* Exposing application ports to the host machine.
* Viewing container logs and troubleshooting service issues.

## 🔮 Future Improvements

* Add automated testing.
* Implement a CI/CD pipeline using GitHub Actions.
* Add environment-based configuration and secret management.
* Deploy the application to a cloud environment.
* Add monitoring and health checks for the application services.

## 👨‍💻 Author

**Mahmoud Khaled Nassar**

Computer Science Student | Aspiring DevOps Engineer

GitHub: [mahmoudnassaredu](https://github.com/mahmoudnassaredu)

---

*Built as a hands-on project to develop practical containerization and DevOps skills.*
