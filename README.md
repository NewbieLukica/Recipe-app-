# Recipe Collection App

A simple web application to store, view, edit, and filter a personal recipe collection. Recipes can be added from a link or as a custom entry with ingredients.

## Prerequisites

Before you begin, ensure you have the following installed on your new PC:

- **Node.js**: This is the runtime environment for the application. Installing Node.js will also install `npm`. It's recommended to use a recent LTS (Long Term Support) version.

## Setup and Installation

Follow these steps to get the application running on a new machine.

### 1. Copy the Project

Move the entire project folder (the one containing `server.js`, `package.json`, and the `public` folder) to your new PC.

### 2. Install Dependencies

The project relies on external libraries (like Express) to run. You can install them easily using `npm`.

- Open a terminal, command prompt, or PowerShell.
- Navigate into the root directory of the project (e.g., `cd C:\Users\YourUser\Desktop\Cooking`).
- Run the following command:

  ```bash
  npm install
  ```

  This command reads the `package.json` file and automatically downloads all the necessary libraries into a `node_modules` folder.

### 3. Run the Application

Once the installation is complete, you can start the server.

- In the same terminal, run the following command:

  ```bash
  npm start
  ```

- You will see a message in the terminal: `Server is running on http://localhost:3000`.
- Open your web browser and navigate to **http://localhost:3000** to use the application.