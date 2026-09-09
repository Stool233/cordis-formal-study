---- MODULE CordisTrace ----
(***************************************************************************)
(* Cursor-based validation of cordis.paper-trace/v1 NDJSON observations.    *)
(***************************************************************************)

EXTENDS FiniteSets, IOUtils, Json, Naturals, Sequences, TLC

JsonFile == IF "JSON" \in DOMAIN IOEnv THEN IOEnv.JSON ELSE "formal/output/trace.ndjson"
TraceLog == SelectSeq(ndJsonDeserialize(JsonFile), LAMBDA line : line.tag = "trace")

ASSUME Len(TraceLog) > 0

VARIABLES cursor, abstractState, launched
traceVars == <<cursor, abstractState, launched>>

StateFields == {"fibers", "services", "resources"}
FiberFields == {"id", "parent", "retired", "lifecycle", "outcome", "target", "committed", "accumulator", "inFlight"}
Lifecycles == {"Inactive", "Reloading", "Active", "Unloading"}
Outcomes == {"bottom", "error"}
ResourceStatuses == {"installed", "restoring", "failed"}

SeqSet(sequence) == {sequence[index] : index \in 1..Len(sequence)}
FiberSet(state) == SeqSet(state.fibers)
FiberIds(state) == {fiber.id : fiber \in FiberSet(state)}
RetiredIds(state) == {fiber.id : fiber \in {candidate \in FiberSet(state) : candidate.retired}}
ServiceSet(state) == SeqSet(state.services)
ServiceKeys(state) == {service.key : service \in ServiceSet(state)}
ResourceSet(state) == SeqSet(state.resources)
ResourceIds(state) == {resource.id : resource \in ResourceSet(state)}

FiberById(state, id) == CHOOSE fiber \in FiberSet(state) : fiber.id = id
ResourceById(state, id) == CHOOSE resource \in ResourceSet(state) : resource.id = id

AccumulatorResources(fiber) ==
  UNION {SeqSet(entry.resources) : entry \in SeqSet(fiber.accumulator)}

StackFor(state, fiberId, iterator) ==
  LET fiber == FiberById(state, fiberId)
      entries == {entry \in SeqSet(fiber.accumulator) : entry.iterator = iterator}
  IN IF entries = {} THEN <<>> ELSE (CHOOSE entry \in entries : TRUE).resources

FieldsUnchangedExcept(before, after, allowed) ==
  /\ DOMAIN before = DOMAIN after
  /\ \A field \in DOMAIN before \ allowed : before[field] = after[field]

OtherFibersUnchanged(before, after, id) ==
  /\ \A fiber \in FiberSet(before) :
       fiber.id # id => fiber \in FiberSet(after)
  /\ \A fiber \in FiberSet(after) :
       fiber.id # id => fiber \in FiberSet(before)

NamedFiberChangedOnly(before, after, id, allowed) ==
  /\ id \in FiberIds(before) \cap FiberIds(after)
  /\ OtherFibersUnchanged(before, after, id)
  /\ FieldsUnchangedExcept(FiberById(before, id), FiberById(after, id), allowed)

UniqueIds(sequence, field) ==
  Len(sequence) = Cardinality({sequence[index][field] : index \in 1..Len(sequence)})

BindingWellFormed(binding, state, targetBinding) ==
  /\ DOMAIN binding = {"key", "provider"}
  /\ binding.provider = "root" \/ binding.provider \in FiberIds(state)
  /\ (targetBinding => binding.provider \notin RetiredIds(state))

FiberWellFormed(fiber, state) ==
  /\ DOMAIN fiber = FiberFields
  /\ fiber.parent = "root" \/ fiber.parent \in FiberIds(state)
  /\ fiber.lifecycle \in Lifecycles
  /\ fiber.outcome \in Outcomes
  /\ UniqueIds(fiber.target, "key")
  /\ UniqueIds(fiber.committed, "key")
  /\ UniqueIds(fiber.accumulator, "iterator")
  /\ \A binding \in SeqSet(fiber.target) : BindingWellFormed(binding, state, TRUE)
  /\ \A binding \in SeqSet(fiber.committed) : BindingWellFormed(binding, state, FALSE)
  /\ \A entry \in SeqSet(fiber.accumulator) :
       /\ DOMAIN entry = {"iterator", "resources"}
       /\ SeqSet(entry.resources) \subseteq ResourceIds(state)
  /\ SeqSet(fiber.inFlight) = {}
  /\ (fiber.lifecycle = "Inactive" => fiber.committed = <<>>)
  /\ (fiber.lifecycle = "Active" => fiber.committed = fiber.target)

StateWellFormed(state) ==
  /\ DOMAIN state = StateFields
  /\ UniqueIds(state.fibers, "id")
  /\ UniqueIds(state.services, "key")
  /\ UniqueIds(state.resources, "id")
  /\ \A fiber \in FiberSet(state) : FiberWellFormed(fiber, state)
  /\ \A service \in ServiceSet(state) :
       /\ DOMAIN service = {"key", "provider"}
       /\ service.provider \in FiberIds(state)
  /\ \A resource \in ResourceSet(state) :
       /\ DOMAIN resource = {"id", "owner", "iterator", "status"}
       /\ resource.owner \in FiberIds(state)
       /\ resource.status \in ResourceStatuses
  /\ \A fiber \in FiberSet(state) :
       AccumulatorResources(fiber) \subseteq ResourceIds(state)

logline == TraceLog[cursor]
point == logline.observation.point

SameEnvelope ==
  /\ logline.schema = "cordis.paper-trace/v1"
  /\ logline.sequence = cursor
  /\ logline.scenario = TraceLog[1].scenario
  /\ logline.implementation = TraceLog[1].implementation
  /\ logline.assumptions = TraceLog[1].assumptions

TraceInit ==
  /\ TraceLog[1].schema = "cordis.paper-trace/v1"
  /\ TraceLog[1].tag = "trace"
  /\ TraceLog[1].sequence = 1
  /\ TraceLog[1].observation.point = "trace-init"
  /\ StateWellFormed(TraceLog[1].state)
  /\ cursor = 2
  /\ abstractState = TraceLog[1].state
  /\ launched = {}

FiberCreated(before, after, event) ==
  /\ event.fiber \notin FiberIds(before)
  /\ event.fiber \in FiberIds(after)
  /\ Cardinality(FiberIds(after)) = Cardinality(FiberIds(before)) + 1
  /\ OtherFibersUnchanged(before, after, event.fiber)
  /\ FiberById(after, event.fiber).parent = event.parent
  /\ FieldsUnchangedExcept(before, after, {"fibers"})

FiberRetired(before, after, event) ==
  /\ NamedFiberChangedOnly(before, after, event.fiber, {"retired"})
  /\ ~FiberById(before, event.fiber).retired
  /\ FiberById(after, event.fiber).retired
  /\ FieldsUnchangedExcept(before, after, {"fibers"})

FiberRemoved(before, after, event) == before = after

TargetChanged(before, after, event) ==
  /\ NamedFiberChangedOnly(before, after, event.fiber, {"target"})
  /\ FiberById(before, event.fiber).target = event.previous
  /\ FiberById(after, event.fiber).target = event.current
  /\ FieldsUnchangedExcept(before, after, {"fibers"})
  /\ IF FiberById(after, event.fiber).lifecycle = "Active"
        /\ FiberById(after, event.fiber).target # FiberById(after, event.fiber).committed
     THEN /\ cursor < Len(TraceLog)
          /\ TraceLog[cursor + 1].observation.point = "state-changed"
          /\ TraceLog[cursor + 1].observation.fiber = event.fiber
          /\ TraceLog[cursor + 1].observation.current = "Unloading"
     ELSE TRUE

CommittedChanged(before, after, event) ==
  /\ NamedFiberChangedOnly(before, after, event.fiber, {"committed"})
  /\ FiberById(before, event.fiber).committed = event.previous
  /\ FiberById(after, event.fiber).committed = event.current
  /\ FieldsUnchangedExcept(before, after, {"fibers"})

StateChanged(before, after, event) ==
  IF event.current = "absent"
  THEN /\ event.fiber \in FiberIds(before)
       /\ event.fiber \notin FiberIds(after)
       /\ FiberById(before, event.fiber).lifecycle = event.previous
       /\ OtherFibersUnchanged(before, after, event.fiber)
       /\ FieldsUnchangedExcept(before, after, {"fibers"})
  ELSE /\ NamedFiberChangedOnly(before, after, event.fiber, {"lifecycle", "outcome"})
       /\ FiberById(before, event.fiber).lifecycle = event.previous
       /\ FiberById(after, event.fiber).lifecycle = event.current
       /\ (event.current # "Active" \/ FiberById(after, event.fiber).target = FiberById(after, event.fiber).committed)
       /\ FieldsUnchangedExcept(before, after, {"fibers"})

IterationObserved(before, after, event) ==
  /\ event.iterator \in launched
  /\ before = after

InverseCollected(before, after, event) ==
  /\ NamedFiberChangedOnly(before, after, event.fiber, {"accumulator"})
  /\ FieldsUnchangedExcept(before, after, {"fibers", "resources"})
  /\ event.resource \notin ResourceIds(before)
  /\ event.resource \in ResourceIds(after)
  /\ ResourceIds(after) = ResourceIds(before) \cup {event.resource}
  /\ StackFor(after, event.fiber, event.iterator) = Append(StackFor(before, event.fiber, event.iterator), event.resource)

InverseStarted(before, after, event) ==
  /\ event.resource \in ResourceIds(before) \cap ResourceIds(after)
  /\ Len(StackFor(before, event.fiber, event.iterator)) > 0
  /\ StackFor(before, event.fiber, event.iterator)[Len(StackFor(before, event.fiber, event.iterator))] = event.resource
  /\ ResourceById(before, event.resource).status = "installed"
  /\ ResourceById(after, event.resource).status = "restoring"
  /\ FieldsUnchangedExcept(ResourceById(before, event.resource), ResourceById(after, event.resource), {"status"})
  /\ before.fibers = after.fibers
  /\ FieldsUnchangedExcept(before, after, {"resources"})

ConsumersQuiet(state, provider) ==
  \A consumer \in FiberSet(state) :
    (\E binding \in SeqSet(consumer.committed) : binding.provider = provider) =>
      consumer.lifecycle = "Inactive"

InverseFinished(before, after, event) ==
  /\ event.resource \in ResourceIds(before)
  /\ Len(StackFor(before, event.fiber, event.iterator)) > 0
  /\ StackFor(before, event.fiber, event.iterator)[Len(StackFor(before, event.fiber, event.iterator))] = event.resource
  /\ StackFor(after, event.fiber, event.iterator) = SubSeq(StackFor(before, event.fiber, event.iterator), 1, Len(StackFor(before, event.fiber, event.iterator)) - 1)
  /\ NamedFiberChangedOnly(before, after, event.fiber, {"accumulator"})
  /\ FieldsUnchangedExcept(before, after, {"fibers", "resources"})
  /\ IF event.failed
     THEN /\ event.resource \in ResourceIds(after)
          /\ ResourceById(after, event.resource).status = "failed"
     ELSE event.resource \notin ResourceIds(after)

ServiceProvided(before, after, event) ==
  /\ FieldsUnchangedExcept(before, after, {"services"})
  /\ ServiceSet(after) = ServiceSet(before) \cup {[key |-> event.key, provider |-> event.provider]}

ServiceWithdrawing(before, after, event) == before = after

ServiceWithdrawn(before, after, event) ==
  /\ FieldsUnchangedExcept(before, after, {"services"})
  /\ ServiceSet(before) = ServiceSet(after) \cup {[key |-> event.key, provider |-> event.provider]}

ObservedStep(before, after, event) ==
  /\ StateWellFormed(after)
  /\ CASE event.point = "fiber-created" -> FiberCreated(before, after, event)
        [] event.point = "fiber-retired" -> FiberRetired(before, after, event)
        [] event.point = "fiber-removed" -> FiberRemoved(before, after, event)
        [] event.point = "target-changed" -> TargetChanged(before, after, event)
        [] event.point = "committed-changed" -> CommittedChanged(before, after, event)
        [] event.point = "state-changed" -> StateChanged(before, after, event)
        [] event.point = "iteration-landed" -> IterationObserved(before, after, event)
        [] event.point = "iteration-raised" -> IterationObserved(before, after, event)
        [] event.point = "inverse-collected" -> InverseCollected(before, after, event)
        [] event.point = "inverse-started" -> InverseStarted(before, after, event) /\ ConsumersQuiet(before, event.fiber)
        [] event.point = "inverse-finished" -> InverseFinished(before, after, event)
        [] event.point = "inverse-bookkeeping-started" -> before = after
        [] event.point = "inverse-bookkeeping-finished" -> before = after
        [] event.point = "service-provided" -> ServiceProvided(before, after, event)
        [] event.point = "service-withdrawing" -> ServiceWithdrawing(before, after, event)
        [] event.point = "service-withdrawn" -> ServiceWithdrawn(before, after, event)

SilentLaunch ==
  /\ cursor <= Len(TraceLog)
  /\ point \in {"iteration-landed", "iteration-raised"}
  /\ logline.observation.iterator \notin launched
  /\ launched' = launched \cup {logline.observation.iterator}
  /\ UNCHANGED <<cursor, abstractState>>

TraceStep ==
  /\ cursor <= Len(TraceLog)
  /\ SameEnvelope
  /\ ObservedStep(abstractState, logline.state, logline.observation)
  /\ abstractState' = logline.state
  /\ cursor' = cursor + 1
  /\ IF point \in {"iteration-landed", "iteration-raised"}
     THEN launched' = launched \ {logline.observation.iterator}
     ELSE UNCHANGED launched

TraceNext ==
  \/ SilentLaunch
  \/ TraceStep
  \/ /\ cursor > Len(TraceLog)
     /\ UNCHANGED traceVars

TraceStateWellFormed == StateWellFormed(abstractState)
TraceMatched == <>(cursor > Len(TraceLog))

TraceSpec ==
  /\ TraceInit
  /\ [][TraceNext]_traceVars
  /\ WF_traceVars(SilentLaunch)
  /\ WF_traceVars(TraceStep)

====
