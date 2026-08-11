# Critterpedia

`nookipedia-api`의 모동숲 생물 데이터를 정적 스냅샷으로 가져와 GitHub Pages에 바로 배포할 수 있게 만든 독립형 생물도감입니다.

## 포함 기능

- 곤충 / 물고기 / 해산물 탭
- 한글 / 영문 이름 검색
- 북반구 / 남반구 전환
- 현재 시각 기준 출현 생물 필터
- 잡은 여부 / 박물관 기증 여부 체크
- 브라우저 `localStorage` 기반 저장
- 상세 정보 패널
- GitHub Pages 배포 워크플로

## 파일 구성

- `index.html`: 정적 페이지 진입점
- `styles.css`: 화면 스타일
- `app.js`: 데이터 로딩, 필터링, 렌더링, 상태 저장
- `data/critters.json`: 배포용 생물 스냅샷
- `scripts/build_critterpedia_data.py`: 생물 스냅샷 생성 스크립트
- `.github/workflows/deploy-pages.yml`: GitHub Pages 배포 워크플로

## 데이터 갱신

이 스크립트는 현재 워크스페이스의 형제 폴더인 `nookipedia-api/data/content_full_snapshot.json`을 읽습니다.

```bash
python3 scripts/build_critterpedia_data.py
```
