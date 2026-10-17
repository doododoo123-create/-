import { clone, DEFAULT_RULES } from '../model/world.js';

const DATA = {
  "schemaVersion": 1,
  "id": "seven-realms-grid-demo",
  "name": "칠국의 여명",
  "description": "서로 다른 일곱 나라, 아직 쓰이지 않은 하나의 역사. 사용자 원본의 국가·인물·영토를 격자로 옮긴 시작 세계입니다.",
  "rows": 8,
  "cols": 10,
  "countries": [
    {
      "id": "nation-0",
      "name": "청람국",
      "color": "#6da9ff",
      "troops": 10,
      "recruitment": 0,
      "personality": "balanced"
    },
    {
      "id": "nation-1",
      "name": "적연국",
      "color": "#ef8179",
      "troops": 10,
      "recruitment": 0,
      "personality": "aggressive"
    },
    {
      "id": "nation-2",
      "name": "금휘국",
      "color": "#eac66b",
      "troops": 10,
      "recruitment": 0,
      "personality": "peaceful"
    },
    {
      "id": "nation-3",
      "name": "백록국",
      "color": "#6bceb4",
      "troops": 10,
      "recruitment": 0,
      "personality": "balanced"
    },
    {
      "id": "nation-4",
      "name": "자운국",
      "color": "#be9aeb",
      "troops": 10,
      "recruitment": 0,
      "personality": "peaceful"
    },
    {
      "id": "nation-5",
      "name": "현해국",
      "color": "#6fd4e6",
      "troops": 10,
      "recruitment": 0,
      "personality": "balanced"
    },
    {
      "id": "nation-6",
      "name": "황사국",
      "color": "#e9a65e",
      "troops": 10,
      "recruitment": 0,
      "personality": "aggressive"
    }
  ],
  "people": [
    {
      "id": "king-0",
      "name": "서윤",
      "countryId": "nation-0",
      "role": "king",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "minister-0",
      "name": "한제",
      "countryId": "nation-0",
      "role": "minister",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-0-0",
      "name": "진우",
      "countryId": "nation-0",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-0-1",
      "name": "문석",
      "countryId": "nation-0",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-0-2",
      "name": "류건",
      "countryId": "nation-0",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-0-3",
      "name": "정하",
      "countryId": "nation-0",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-0-4",
      "name": "손범",
      "countryId": "nation-0",
      "role": "general",
      "ability": -2,
      "personality": "balanced"
    },
    {
      "id": "king-1",
      "name": "강혁",
      "countryId": "nation-1",
      "role": "king",
      "ability": 0,
      "personality": "aggressive"
    },
    {
      "id": "minister-1",
      "name": "위탁",
      "countryId": "nation-1",
      "role": "minister",
      "ability": -2,
      "personality": "balanced"
    },
    {
      "id": "general-1-0",
      "name": "강무",
      "countryId": "nation-1",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-1-1",
      "name": "염수",
      "countryId": "nation-1",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-1-2",
      "name": "도찬",
      "countryId": "nation-1",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-1-3",
      "name": "허량",
      "countryId": "nation-1",
      "role": "general",
      "ability": -2,
      "personality": "balanced"
    },
    {
      "id": "king-2",
      "name": "유온",
      "countryId": "nation-2",
      "role": "king",
      "ability": 0,
      "personality": "peaceful"
    },
    {
      "id": "minister-2",
      "name": "배문",
      "countryId": "nation-2",
      "role": "minister",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-2-0",
      "name": "배준",
      "countryId": "nation-2",
      "role": "general",
      "ability": -2,
      "personality": "balanced"
    },
    {
      "id": "general-2-1",
      "name": "금서",
      "countryId": "nation-2",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-2-2",
      "name": "서항",
      "countryId": "nation-2",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-2-3",
      "name": "나원",
      "countryId": "nation-2",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "king-3",
      "name": "백린",
      "countryId": "nation-3",
      "role": "king",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "minister-3",
      "name": "도겸",
      "countryId": "nation-3",
      "role": "minister",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-3-0",
      "name": "백진",
      "countryId": "nation-3",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-3-1",
      "name": "임하",
      "countryId": "nation-3",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-3-2",
      "name": "도윤",
      "countryId": "nation-3",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "king-4",
      "name": "영소",
      "countryId": "nation-4",
      "role": "king",
      "ability": 0,
      "personality": "peaceful"
    },
    {
      "id": "minister-4",
      "name": "묵현",
      "countryId": "nation-4",
      "role": "minister",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-4-0",
      "name": "영준",
      "countryId": "nation-4",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-4-1",
      "name": "묵진",
      "countryId": "nation-4",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-4-2",
      "name": "유경",
      "countryId": "nation-4",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "king-5",
      "name": "현도",
      "countryId": "nation-5",
      "role": "king",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "minister-5",
      "name": "해명",
      "countryId": "nation-5",
      "role": "minister",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-5-0",
      "name": "현우",
      "countryId": "nation-5",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    },
    {
      "id": "general-5-1",
      "name": "해준",
      "countryId": "nation-5",
      "role": "general",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "king-6",
      "name": "사혁",
      "countryId": "nation-6",
      "role": "king",
      "ability": 0,
      "personality": "aggressive"
    },
    {
      "id": "minister-6",
      "name": "담윤",
      "countryId": "nation-6",
      "role": "minister",
      "ability": 0,
      "personality": "balanced"
    },
    {
      "id": "general-6-0",
      "name": "사준",
      "countryId": "nation-6",
      "role": "general",
      "ability": 2,
      "personality": "balanced"
    }
  ],
  "territories": [
    {
      "id": "tile-0",
      "row": 0,
      "col": 0,
      "name": "서원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-1",
      "row": 0,
      "col": 1,
      "name": "운원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-2",
      "row": 0,
      "col": 2,
      "name": "청원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-3",
      "row": 0,
      "col": 3,
      "name": "해원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-4",
      "row": 0,
      "col": 4,
      "name": "송원",
      "ownerId": "nation-6"
    },
    {
      "id": "tile-5",
      "row": 0,
      "col": 5,
      "name": "백원",
      "ownerId": "nation-6"
    },
    {
      "id": "tile-6",
      "row": 0,
      "col": 6,
      "name": "진원",
      "ownerId": "nation-6"
    },
    {
      "id": "tile-7",
      "row": 0,
      "col": 7,
      "name": "금원",
      "ownerId": "nation-6"
    },
    {
      "id": "tile-8",
      "row": 0,
      "col": 8,
      "name": "연원",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-9",
      "row": 0,
      "col": 9,
      "name": "평원",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-10",
      "row": 1,
      "col": 0,
      "name": "남원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-11",
      "row": 1,
      "col": 1,
      "name": "북원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-12",
      "row": 1,
      "col": 2,
      "name": "월원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-13",
      "row": 1,
      "col": 3,
      "name": "덕원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-14",
      "row": 1,
      "col": 4,
      "name": "안원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-15",
      "row": 1,
      "col": 5,
      "name": "한원",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-16",
      "row": 1,
      "col": 6,
      "name": "영원",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-17",
      "row": 1,
      "col": 7,
      "name": "현원",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-18",
      "row": 1,
      "col": 8,
      "name": "양원",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-19",
      "row": 1,
      "col": 9,
      "name": "장원",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-20",
      "row": 2,
      "col": 0,
      "name": "서릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-21",
      "row": 2,
      "col": 1,
      "name": "운릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-22",
      "row": 2,
      "col": 2,
      "name": "청릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-23",
      "row": 2,
      "col": 3,
      "name": "해릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-24",
      "row": 2,
      "col": 4,
      "name": "송릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-25",
      "row": 2,
      "col": 5,
      "name": "백릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-26",
      "row": 2,
      "col": 6,
      "name": "진릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-27",
      "row": 2,
      "col": 7,
      "name": "금릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-28",
      "row": 2,
      "col": 8,
      "name": "연릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-29",
      "row": 2,
      "col": 9,
      "name": "평릉",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-30",
      "row": 3,
      "col": 0,
      "name": "남릉",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-31",
      "row": 3,
      "col": 1,
      "name": "북릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-32",
      "row": 3,
      "col": 2,
      "name": "월릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-33",
      "row": 3,
      "col": 3,
      "name": "덕릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-34",
      "row": 3,
      "col": 4,
      "name": "안릉",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-35",
      "row": 3,
      "col": 5,
      "name": "한릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-36",
      "row": 3,
      "col": 6,
      "name": "영릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-37",
      "row": 3,
      "col": 7,
      "name": "현릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-38",
      "row": 3,
      "col": 8,
      "name": "양릉",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-39",
      "row": 3,
      "col": 9,
      "name": "장릉",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-40",
      "row": 4,
      "col": 0,
      "name": "서곡",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-41",
      "row": 4,
      "col": 1,
      "name": "운곡",
      "ownerId": "nation-0"
    },
    {
      "id": "tile-42",
      "row": 4,
      "col": 2,
      "name": "청곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-43",
      "row": 4,
      "col": 3,
      "name": "해곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-44",
      "row": 4,
      "col": 4,
      "name": "송곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-45",
      "row": 4,
      "col": 5,
      "name": "백곡",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-46",
      "row": 4,
      "col": 6,
      "name": "진곡",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-47",
      "row": 4,
      "col": 7,
      "name": "금곡",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-48",
      "row": 4,
      "col": 8,
      "name": "연곡",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-49",
      "row": 4,
      "col": 9,
      "name": "평곡",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-50",
      "row": 5,
      "col": 0,
      "name": "남곡",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-51",
      "row": 5,
      "col": 1,
      "name": "북곡",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-52",
      "row": 5,
      "col": 2,
      "name": "월곡",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-53",
      "row": 5,
      "col": 3,
      "name": "덕곡",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-54",
      "row": 5,
      "col": 4,
      "name": "안곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-55",
      "row": 5,
      "col": 5,
      "name": "한곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-56",
      "row": 5,
      "col": 6,
      "name": "영곡",
      "ownerId": "nation-1"
    },
    {
      "id": "tile-57",
      "row": 5,
      "col": 7,
      "name": "현곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-58",
      "row": 5,
      "col": 8,
      "name": "양곡",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-59",
      "row": 5,
      "col": 9,
      "name": "장곡",
      "ownerId": "nation-5"
    },
    {
      "id": "tile-60",
      "row": 6,
      "col": 0,
      "name": "서주",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-61",
      "row": 6,
      "col": 1,
      "name": "운주",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-62",
      "row": 6,
      "col": 2,
      "name": "청주",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-63",
      "row": 6,
      "col": 3,
      "name": "해주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-64",
      "row": 6,
      "col": 4,
      "name": "송주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-65",
      "row": 6,
      "col": 5,
      "name": "백주",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-66",
      "row": 6,
      "col": 6,
      "name": "진주",
      "ownerId": "nation-4"
    },
    {
      "id": "tile-67",
      "row": 6,
      "col": 7,
      "name": "금주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-68",
      "row": 6,
      "col": 8,
      "name": "연주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-69",
      "row": 6,
      "col": 9,
      "name": "평주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-70",
      "row": 7,
      "col": 0,
      "name": "남주",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-71",
      "row": 7,
      "col": 1,
      "name": "북주",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-72",
      "row": 7,
      "col": 2,
      "name": "월주",
      "ownerId": "nation-3"
    },
    {
      "id": "tile-73",
      "row": 7,
      "col": 3,
      "name": "덕주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-74",
      "row": 7,
      "col": 4,
      "name": "안주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-75",
      "row": 7,
      "col": 5,
      "name": "한주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-76",
      "row": 7,
      "col": 6,
      "name": "영주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-77",
      "row": 7,
      "col": 7,
      "name": "현주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-78",
      "row": 7,
      "col": 8,
      "name": "양주",
      "ownerId": "nation-2"
    },
    {
      "id": "tile-79",
      "row": 7,
      "col": 9,
      "name": "장주",
      "ownerId": "nation-2"
    }
  ]
};
export const createDemoWorld = () => ({ ...clone(DATA), rules: clone(DEFAULT_RULES) });
