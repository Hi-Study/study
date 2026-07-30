import { useEffect, useState } from "react";
import type { RouteProp } from "@react-navigation/native";

import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useStudy, useUpdateStudy } from "@/data/studies";
import { Loading, PillButton, TextField } from "@/components";
import { Screen, ScreenHeader } from "@/components/Chrome";

type R = RouteProp<RootStackParamList, "StudyEdit">;

export function StudyEditScreen({ route }: { route: R }) {
  const nav = useRootNav();
  const { studyId } = route.params;
  const study = useStudy(studyId);
  const update = useUpdateStudy(studyId);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (study.data && !ready) {
      setName(study.data.name);
      setDesc(study.data.description ?? "");
      setReady(true);
    }
  }, [study.data, ready]);

  function save() {
    update.mutate(
      { name: name.trim(), description: desc.trim() || null },
      { onSuccess: () => nav.goBack() },
    );
  }

  return (
    <Screen
      header={<ScreenHeader title="스터디 수정" onBack={() => nav.goBack()} />}
      keyboardAvoiding
      contentStyle={{ padding: 20, gap: 16 }}
    >
      {!ready ? (
        <Loading />
      ) : (
        <>
          <TextField label="스터디 이름" value={name} onChangeText={setName} placeholder="스터디 이름" maxLength={40} />
          <TextField label="소개" value={desc} onChangeText={setDesc} placeholder="한 줄 소개" multiline maxLength={200} />
          <PillButton
            label="저장"
            onPress={save}
            disabled={name.trim().length === 0}
            loading={update.isPending}
          />
        </>
      )}
    </Screen>
  );
}
