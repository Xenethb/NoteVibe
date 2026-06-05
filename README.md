# NoteVibe 📱✦

> An advanced full-stack mobile note management and revision utility built with **React Native**, **TypeScript**, and **Supabase**.

NoteVibe is designed to elevate the student learning workflow by allowing users to capture handwritten notes, search scanned documents using OCR, track study progress through gamified statistics, and interact with an integrated AI-powered study assistant.

---

## 📸 App Architecture & Screens

<table>
<tr>
<td width="50%" align="center">

### 🏠 Workspace Hub (Home)

<img src="https://github.com/user-attachments/assets/6a054540-d126-466c-8d59-84e57814b74c" width="100%" />

Clean dashboard organizing academic subjects with dynamic, cached visual page previews.

</td>

<td width="50%" align="center">

### 🔍 Deep OCR Search Engine

<img src="https://github.com/user-attachments/assets/2c738d38-9e9d-4327-bc24-e520575dc37a" width="100%" />

Full-text keyword matching that instantly searches through text extracted from your scanned notes.

</td>
</tr>

<tr>
<td width="50%" align="center">

### 🐱 Pet Stats & Study Progress

<img src="https://github.com/user-attachments/assets/f2f15cd0-3b80-42df-8021-100da9123f036" width="100%" />

Gamified tracking dashboard that visualizes study metrics alongside an interactive virtual pet system.

</td>

<td width="50%" align="center">

### 📚 Immersive Reader & Note Upload

<img src="https://github.com/user-attachments/assets/5fe3ae5e-8a42-4abe-9747-9b4a48acf377" width="100%" />

Gesture-responsive reader with tools to scan documents directly from the camera or import images from the gallery.

</td>
</tr>
</table>

---

## ⚡ Core Features

### 🔎 On-Device OCR Processing

* Fast local text recognition
* Multi-page note scanning
* Offline-friendly processing pipeline
* Searchable handwritten and printed content

### 🤖 AI Study Assistant

* Gemini-powered learning assistant
* Summaries and explanations
* Study guidance and revision support
* Secure API key integration via environment variables

### 📄 PDF Compilation Engine

* Convert multiple note images into PDF documents
* High-performance image processing
* Export and share notes effortlessly

### 🎨 Modern Mobile Experience

* Adaptive bottom sheet modals
* Smooth gesture interactions
* Responsive layouts
* Optimized page navigation

### 💾 Persistent State Management

* Zustand-powered global state
* Local storage persistence
* Session timer retention
* User preference storage

---

## 🛠️ Tech Stack

| Category         | Technology                  |
| ---------------- | --------------------------- |
| Framework        | React Native (Expo)         |
| Language         | TypeScript, JavaScript ES6+ |
| Backend          | Supabase                    |
| State Management | Zustand                     |
| OCR              | On-Device Text Recognition  |
| AI Integration   | Google Gemini API           |
| UI Components    | React Native PagerView      |
| Animations       | Animated API                |
| Image Viewer     | Image Pan Zoom Matrix       |

---

## 📂 Project Structure

```text
NoteVibe/
├── assets/
├── components/
├── screens/
├── services/
├── store/
├── hooks/
├── utils/
├── types/
├── App.tsx
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure the following tools are installed:

* Node.js (v18+ recommended)
* Git
* Expo Go App (Android/iOS)

Alternatively:

* Android Studio Emulator
* iOS Simulator (macOS)

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/NoteVibe.git
cd NoteVibe
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Configure Environment Variables

Create a `.env` file in the project root:

```env
# Gemini API Key
EXPO_PUBLIC_GEMINI_KEY=your_actual_gemini_api_key_here

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Ensure `.env` is included in `.gitignore` to protect sensitive credentials.

---

### 4️⃣ Start the Development Server

```bash
npx expo start
```

---

### 5️⃣ Launch the Application

#### Android Emulator

Press:

```text
a
```

inside the Expo terminal.

#### Physical Device

1. Open Expo Go.
2. Scan the generated QR code.
3. The application will load over your local network.

#### Native Android Build

```bash
npx expo run:android
```

---

## 🎯 Future Roadmap

* [ ] Cloud note synchronization
* [ ] Shared collaborative workspaces
* [ ] Flashcard generation from notes
* [ ] Smart revision scheduling
* [ ] AI-generated quizzes
* [ ] Advanced analytics dashboard
* [ ] Dark mode themes

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/new-feature
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push to GitHub

```bash
git push origin feature/new-feature
```

5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🌟 Support

If you found this project useful:

⭐ Star the repository

🐛 Report issues

🚀 Share with fellow students

---

Built with ❤️ using React Native, TypeScript, Supabase, and Gemini AI.
