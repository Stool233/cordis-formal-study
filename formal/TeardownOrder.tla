---- MODULE TeardownOrder ----
(***************************************************************************)
(* Focused replay of the unload guard in recorded implementation traces.   *)
(* This does not assume Active => target = committed or model all of v1.    *)
(***************************************************************************)
EXTENDS IOUtils, Json, Naturals, Sequences, TLC

TraceLog == ndJsonDeserialize(IOEnv.JSON)
ASSUME Len(TraceLog) > 1

VARIABLE cursor
Init == cursor = 2
Next == IF cursor <= Len(TraceLog) THEN cursor' = cursor + 1
        ELSE UNCHANGED cursor
Spec == Init /\ [][Next]_cursor /\ WF_cursor(Next)

DependencySafeRecovery ==
  IF cursor > Len(TraceLog) THEN TRUE
  ELSE LET event == TraceLog[cursor].observation
           before == TraceLog[cursor - 1].state
       IN IF event.point # "inverse-started" THEN TRUE
          ELSE \A i \in 1..Len(before.fibers) :
                 LET consumer == before.fibers[i]
                 IN (\E j \in 1..Len(consumer.committed) :
                       consumer.committed[j].provider = event.fiber)
                    => consumer.lifecycle = "Inactive"

TraceComplete == <>(cursor > Len(TraceLog))
====
