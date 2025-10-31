# 🌌 Parallel Universe Simulator
### 평행우주 시뮬레이터

![Image](images/parallel_universe_simulator.png)

>**'만약 다른 선택을 했다면 어땠을까?'**

## 📋 목차
- [프로젝트 개요](#-프로젝트-개요)
- [주요 기능](#-주요-기능)
- [프로젝트 이미지](#-프로젝트-이미지)
- [프로젝트 일정](#-프로젝트-일정)
- [팀 구성 및 역할](#-팀-구성-및-역할)
- [기술 스택](#-기술-스택)
- [설치 및 실행](#-설치-및-실행)

---

## 🎯 프로젝트 개요
### Abstract
**평행우주 시뮬레이터**는 기회비용 개념을 실생활에 적용한 플랫폼이다. 사용자의 일상적 선택을 추적하고, 선택하지 않은 대안의 결과를 AI 기반 시뮬레이션을 통해 평행우주를 재구성한다.

### 핵심 컨셉
- 📅 **매일의 선택**
  재정, 건강, 커리어, 관계, 학습 등 5가지 카테고리의 실용적인 선택지 제공
- 🌍 **평행우주 저장**
  선택하지 않은 대안을 자동으로 저장하여 평행우주 생성
- 🤖 **AI 시뮬레이션**
  일정 기간동안 선택 후, 두 우주의 결과를 비교 분석
- 📊 **데이터 기반 인사이트**
  금액, 시간, 만족도 등 실질적인 메트릭으로 의사결정을 지원

### 프로젝트 목적
단순한 선택 추적을 넘어서, **선택의 누적 효과**와 **장기적 영향**을 시각화하여 사용자의 메타인지를 강화하고, 더욱 합리적인 의사결정 프레임워크를 제공하는 것을 목표로 한다.

---

## ✨ 주요 기능
### 1. 일일 선택 시스템
---
카테고리별 맞춤 선택지
- 경제적 자본
- 건강
- 커리어
- 심리적 자본
- 학습적 자본
### 2. 🎮 인터렉티브 UI
- 직관적인 카드 인터페이스 선택지
- 실시간 선택 결과 피드백
- 진행 상황을 보여주는 프로그레스 바
### 3. 📊 비교 대시보드
내가 선택한 우주와 평행 우주 비교
### 4. 📈 데이터 시각화
- 일정 시간동안 선택 타임라인
- 카테고리별 선택 분포 차트
- 누적 효과 비교 그래프

---

## 🛠 기술 스택
### Frontend
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)

**상세 기술**
- **React 18** : UI 컴포넌트 개발
- **Tailwind CSS** : 유틸리티 기반 스타일링
- **Chart.js** : 데이터 시각화
- **Lucide React** : 아이콘

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)

**상세 기술**
- **Node.js v18+** : 서버 런타임
- **Express.js** : RESTful API 프레임워크
- **CORS** : Cross-Origin Resource Sharing

### AI & Data
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)

**상세 기술**
- **OpenAI API** : GPT-4 기반 스토리 생성
- **JSON** : 데이터 저장 및 관ㄹ

### Development Tools
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)
![VS Code](https://img.shields.io/badge/VS_Code-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white)

**상세 기술**
- **Git** : 버전 관리
- **GitHub** : 협업 플랫폼
- **ESLint**: 코드 품질 관리
- **Prettier**: 코드 포맷팅

### Deployment
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)

**배포 플랫폼**
- **Vercel**: 프론트엔드 + 백엔드 통합 배포
- **Netlify**: 정적 사이트 배포 (대안)

### Package Management
![NPM](https://img.shields.io/badge/NPM-CB3837?style=for-the-badge&logo=npm&logoColor=white)

## 👥 역할
|**정하영**|
|**이정현**|
|**김민서**|

## 📅 프로젝트 일정

**전체 기간** : 2025. 10. 31 ~ 2025. 12. 17 (7주)

### 🗓 Week 1: 프로젝트 설정 (10/31 ~ 11/06)
- [X] 역할 분담
- [X] GitHub 저장소 설정
- [X] 프로젝트 구조 설계
- [X] README.md 작성
- [ ] 개발 환경 설정

### 🗓 Week 2: 백엔드 기본 구조 (11/07 ~ 11/13)
- [ ] Node.js + Express 서버 구축
- [ ] RESTful API 설계 및 구현
- [ ] 데이터 저장 구조 설계
- [ ] 선택 저장/조회 API 개발

### 🗓 Week 3: 프론트엔드 UI 개발 (11/14 ~ 11/20)
- [ ] 메인 선택 화면 UI
- [ ] 선택 카드 컴포넌트
- [ ] 진행 상황 표시
- [ ] 반응형 디자인 적용

### 🗓 Week 4: 시뮬레이션 로직 (11/21 ~ 11/27)
- [ ] 평행우주 생성 알고리즘
- [ ] AI 통합 (OpenAI API)
- [ ] 스토리 생성 로직
- [ ] 데이터 계산 및 비교

### 🗓 Week 5: 비교 대시보드 (11/28 ~ 12/04)
- [ ] 비교 페이지 UI
- [ ] 차트 라이브러리 통합
- [ ] 타임라인 시각화
- [ ] 인사이트 표시

### 🗓 Week 6: 통합 및 테스트 (12/05 ~ 12/11)
- [ ] 기능 통합 테스트
- [ ] 버그 수정
- [ ] 사용자 경험 개선
- [ ] 성능 최적화

### 🗓 Week 7: 배포 및 최종 점검 (12/12 ~ 12/17)
- [ ] 웹 배포 (Vercel/Netlify)
- [ ] 문서화 완성
- [ ] 최종 테스트
- [ ] **프로젝트 제출 (12/17)**

## 🚨 변동사항

구현 목표 : 7일동안 축적한 데이터를 기반으로 평행우주 생성
매일매일 선택하는 상황 발생

**하지만** 시간 내에 평가를 받아야 하므로, 

구현 목표 : 임시로 하루동안 축적한 데이터를 기반으로 평행우주를 생성
5분마다 선택하는 상황 발생

!! 구현 계획은 추후에 변동될 수 있음!!